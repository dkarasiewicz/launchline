import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createDeepAgent, DeepAgent } from 'deepagents';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LINEA_MODEL, LINEA_STORE, LINEA_CHECKPOINTER } from '../tokens';
import { ToolsFactory } from './tools.factory';
import { SubagentsFactory } from './subagents.factory';
import { SkillsFactory } from './skills.factory';
import { AgentPromptService } from './agent-prompt.service';
import { buildLineaSystemPrompt } from '../prompts';

export interface LineaAgentState {
  workspaceId: string;
  userId: string;
  threadId?: string;
  messages: unknown[];
  lastSavedMemoryId?: string;
}

@Injectable()
export class AgentFactory implements OnModuleInit {
  private readonly logger = new Logger(AgentFactory.name);
  agent: DeepAgent | null = null;
  private readonly workspaceAgents = new Map<
    string,
    { version: number; agent: DeepAgent }
  >();

  constructor(
    @Inject(LINEA_MODEL)
    private readonly model: BaseChatModel,
    @Inject(LINEA_STORE)
    private readonly store: PostgresStore,
    @Inject(LINEA_CHECKPOINTER)
    private readonly checkpointer: PostgresSaver,
    private readonly toolsFactory: ToolsFactory,
    private readonly subagentsFactory: SubagentsFactory,
    private readonly skillsFactory: SkillsFactory,
    private readonly agentPromptService: AgentPromptService,
  ) {}

  async onModuleInit() {
    // Populate the store with skill files so the agent can access them
    await this.populateSkillsInStore();
  }

  /**
   * Populate the PostgresStore with skill files
   * This makes skills available to the deep agent via the store backend
   */
  private async populateSkillsInStore(): Promise<void> {
    const skillFiles = this.skillsFactory.getSkillFiles();
    const skillPaths = Object.keys(skillFiles);

    if (skillPaths.length === 0) {
      this.logger.warn({ skillPaths }, 'No skills to populate in store');
      return;
    }

    for (const path of skillPaths) {
      const fileData = skillFiles[path];
      try {
        // Store skills under the 'filesystem' namespace for the deep agent
        await this.store.put(
          ['filesystem'],
          path,
          fileData as unknown as Record<string, string>,
        );
        this.logger.debug({ path }, 'Stored skill in agent store');
      } catch (error) {
        this.logger.error(
          { err: error, path },
          'Failed to store skill in agent store',
        );
      }
    }

    this.logger.log(
      { count: skillPaths.length },
      'Populated skills in agent store',
    );
  }

  getAgent(): DeepAgent {
    if (!this.agent) {
      this.agent = this.createAgent();
    }
    return this.agent;
  }

  async getAgentForWorkspace(workspaceId: string): Promise<DeepAgent> {
    const record =
      await this.agentPromptService.getWorkspacePromptRecord(workspaceId);
    const version = record?.version ?? 0;
    const cached = this.workspaceAgents.get(workspaceId);

    if (cached && cached.version === version) {
      return cached.agent;
    }

    const agent = this.createAgent(record?.prompt);
    this.workspaceAgents.set(workspaceId, { version, agent });
    return agent;
  }

  /**
   * Get skill files for agent invocation
   * These files are passed to the agent's invoke method
   */
  getSkillFiles(): Record<
    string,
    { content: string[]; created_at: string; modified_at: string }
  > {
    return this.skillsFactory.getSkillFiles();
  }

  /**
   * Get skill summaries to append to system prompt context
   */
  getSkillSummaries(): string {
    return this.skillsFactory.getSkillSummaries();
  }

  createAgent(workspacePrompt?: string): DeepAgent {
    const tools = this.toolsFactory.createAllTools();
    const subagents = this.subagentsFactory.createAllSubagents();
    const skillPaths = this.skillsFactory.getSkillPaths();

    // Enhance system prompt with skill summaries
    const enhancedSystemPrompt = buildLineaSystemPrompt(
      this.skillsFactory.getSkillSummaries(),
      workspacePrompt,
    );

    this.logger.log(
      {
        toolsCount: tools.length,
        subagentsCount: subagents.length,
        skillsPath: skillPaths.join(', '),
      },
      'Creating Linea agent',
    );

    return createDeepAgent({
      model: this.model,
      tools,
      systemPrompt: enhancedSystemPrompt,
      store: this.store,
      checkpointer: this.checkpointer,
      subagents,
      skills: skillPaths,
      interruptOn: {
        internet_search: true,
      },
    }) as unknown as DeepAgent;
  }
}
