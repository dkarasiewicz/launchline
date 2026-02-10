import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CompositeBackend,
  StateBackend,
  StoreBackend,
  createDeepAgent,
  DeepAgent,
} from 'deepagents';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LINEA_MODEL, LINEA_STORE, LINEA_CHECKPOINTER } from '../tokens';
import { ToolsFactory } from './tools.factory';
import { MemoryService } from './memory.service';
import { SubagentsFactory } from './subagents.factory';
import { SkillsFactory } from './skills.factory';
import { AgentPromptService } from './agent-prompt.service';
import { buildLineaSystemPrompt } from '../prompts';
import { WorkspaceSkillsService } from './workspace-skills.service';

export interface LineaAgentState {
  workspaceId: string;
  userId: string;
  threadId?: string;
  messages: unknown[];
  lastSavedMemoryId?: string;
}

@Injectable()
export class AgentFactory {
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
    private readonly memoryService: MemoryService,
    private readonly workspaceSkillsService: WorkspaceSkillsService,
  ) {}

  private readonly backfilledWorkspaces = new Set<string>();

  getAgent(): DeepAgent {
    if (!this.agent) {
      this.agent = this.createAgent(undefined, undefined);
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

    if (!this.backfilledWorkspaces.has(workspaceId)) {
      try {
        await this.skillsFactory.ensureWorkspaceSkills(workspaceId);
      } catch (error) {
        this.logger.warn(
          { err: error, workspaceId },
          'Failed to seed workspace skills',
        );
      }

      try {
        await this.memoryService.backfillMemoryFiles(workspaceId);
        this.backfilledWorkspaces.add(workspaceId);
      } catch (error) {
        this.logger.warn(
          { err: error, workspaceId },
          'Failed to backfill memory files',
        );
      }

      try {
        await this.workspaceSkillsService.listWorkspaceSkills(workspaceId);
      } catch (error) {
        this.logger.warn(
          { err: error, workspaceId },
          'Failed to validate workspace skills',
        );
      }
    }

    const agent = this.createAgent(record?.prompt, workspaceId);
    this.workspaceAgents.set(workspaceId, { version, agent });
    return agent;
  }

  /**
   * Get skill summaries to append to system prompt context
   */
  getSkillSummaries(): string {
    return this.skillsFactory.getSkillSummaries();
  }

  createAgent(workspacePrompt?: string, workspaceId?: string): DeepAgent {
    const tools = this.toolsFactory.createAllTools();
    const subagents = this.subagentsFactory.createAllSubagents({
      workspaceId,
    });
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
      backend: (config) => {
        const resolved = {
          ...config,
          state: config.state ?? {},
          store: config.store ?? this.store,
        };
        const memoryBackend = new StoreBackend({
          ...resolved,
          assistantId: workspaceId,
        });
        const skillsBackend = new StoreBackend({
          ...resolved,
          assistantId: workspaceId,
        });
        return new CompositeBackend(new StateBackend(resolved), {
          '/memories/': memoryBackend,
          '/skills/': skillsBackend,
        });
      },
    }) as unknown as DeepAgent;
  }
}
