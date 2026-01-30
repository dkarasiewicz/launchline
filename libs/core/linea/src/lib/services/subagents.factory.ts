/**
 * Subagents Factory
 *
 * Creates subagents with access to injected models and tools.
 * Subagents are specialized agents for specific tasks.
 */

import { Inject, Injectable } from '@nestjs/common';
import { createDeepAgent, type CompiledSubAgent } from 'deepagents';
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

type SubagentDefinition = {
  name: string;
  description: string;
  prompt: string;
  model: BaseChatModel;
  toolNames?: string[];
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
  ) {}

  createAllSubagents(): CompiledSubAgent[] {
    return [
      this.createSubagent({
        name: 'summarizer',
        description:
          'Summarizes long content, threads, and discussions into concise points. Use when you need to condense large amounts of text.',
        prompt: SUBAGENT_PROMPTS.summarizer,
        model: this.modelFast,
      }),
      this.createSubagent({
        name: 'researcher',
        description:
          'Deep research across team memories and external sources. Use when you need thorough investigation of historical context, decisions, or patterns.',
        prompt: SUBAGENT_PROMPTS.researcher,
        model: this.modelAnalysis,
        toolNames: [
          'search_memories',
          'get_blockers',
          'get_decisions',
          'internet_search',
        ],
      }),
      this.createSubagent({
        name: 'analyst',
        description:
          'Performs complex multi-factor analysis of situations, decisions, or risks. Uses advanced reasoning for nuanced assessments. Use for important decisions or complex trade-offs.',
        prompt: SUBAGENT_PROMPTS.analyst,
        model: this.modelReasoning,
      }),
      this.createSubagent({
        name: 'reporter',
        description:
          'Generates polished reports and updates for different audiences. Use when creating project updates, stakeholder communications, or standup notes.',
        prompt: SUBAGENT_PROMPTS.reporter,
        model: this.modelAnalysis,
        toolNames: ['search_memories', 'get_blockers', 'get_inbox_items'],
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
