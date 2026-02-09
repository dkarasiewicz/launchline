/**
 * Subagents Factory
 *
 * Creates subagents with access to injected models and tools.
 * Subagents are specialized agents for specific tasks.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  createDeepAgent,
  type BackendProtocol,
  type CompiledSubAgent,
} from 'deepagents';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  LINEA_MODEL_FAST,
  LINEA_MODEL_ANALYSIS,
  LINEA_MODEL_REASONING,
  LINEA_TOOLS,
} from '../tokens';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { Runnable } from '@langchain/core/runnables';
import { SUBAGENT_PROMPTS } from '../prompts';
import { SandboxService } from './sandbox.service';
import { LineaSandboxBackend } from './linea-sandbox-backend';

type SubagentDefinition = {
  name: string;
  description: string;
  prompt: string;
  model: BaseChatModel;
  toolNames?: string[];
  backend?: BackendProtocol;
};

@Injectable()
export class SubagentsFactory {
  constructor(
    @Inject(LINEA_MODEL_FAST)
    private readonly modelFast: BaseChatModel,
    @Inject(LINEA_MODEL_ANALYSIS)
    private readonly modelAnalysis: BaseChatModel,
    @Inject(LINEA_MODEL_REASONING)
    private readonly modelReasoning: BaseChatModel,
    @Inject(LINEA_TOOLS)
    private readonly tools: StructuredToolInterface[],
    private readonly sandboxService: SandboxService,
  ) {}

  createAllSubagents(options?: { workspaceId?: string }): CompiledSubAgent[] {
    const workspaceId = options?.workspaceId;
    const sandboxBackend = workspaceId
      ? new LineaSandboxBackend({
          workspaceId,
          sandboxService: this.sandboxService,
        })
      : undefined;

    return [
      this.createSubagent({
        name: 'distiller',
        description:
          'Compresses long content into a high-signal brief with decisions, blockers, and next actions.',
        prompt: SUBAGENT_PROMPTS.distiller,
        model: this.modelFast,
      }),
      this.createSubagent({
        name: 'context_scout',
        description:
          'Rapidly gathers relevant memories, inbox items, and context across namespaces.',
        prompt: SUBAGENT_PROMPTS.contextScout,
        model: this.modelAnalysis,
        toolNames: [
          'search_memories',
          'get_blockers',
          'get_decisions',
          'get_inbox_items',
          'get_workspace_status',
          'get_team_insights',
          'internet_search',
        ],
      }),
      this.createSubagent({
        name: 'strategist',
        description:
          'Analyzes complex situations and produces prioritized plans with risks and mitigations.',
        prompt: SUBAGENT_PROMPTS.strategist,
        model: this.modelReasoning,
      }),
      this.createSubagent({
        name: 'automation_designer',
        description:
          'Designs sandbox-ready workflows and scripts for safe automation.',
        prompt: SUBAGENT_PROMPTS.automationDesigner,
        model: this.modelAnalysis,
      }),
      this.createSubagent({
        name: 'communications_editor',
        description:
          'Drafts crisp, audience-appropriate updates and requests.',
        prompt: SUBAGENT_PROMPTS.communicationsEditor,
        model: this.modelFast,
        toolNames: ['search_memories', 'get_blockers', 'get_inbox_items'],
      }),
      this.createSubagent({
        name: 'sandbox_runner',
        description:
          'Executes sandbox workflows and reports step results.',
        prompt: SUBAGENT_PROMPTS.sandboxRunner,
        model: this.modelFast,
        toolNames: ['run_sandbox_workflow'],
        backend: sandboxBackend,
      }),
    ];
  }

  private createSubagent(definition: SubagentDefinition): CompiledSubAgent {
    const agent = createDeepAgent({
      model: definition.model,
      tools: definition.toolNames
        ? this.selectTools(definition.toolNames)
        : undefined,
      systemPrompt: definition.prompt,
      backend: definition.backend,
    });

    return {
      name: definition.name,
      description: definition.description,
      runnable: agent as unknown as Runnable,
    };
  }

  private selectTools(toolNames: string[]): StructuredToolInterface[] {
    return this.tools.filter((tool) => toolNames.includes(tool.name));
  }
}
