import { Inject, Injectable } from '@nestjs/common';
import { createDeepAgent, DeepAgent } from 'deepagents';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LINEA_MODEL, LINEA_STORE, LINEA_CHECKPOINTER } from '../tokens';
import { ToolsFactory } from './tools.factory';
import { SubagentsFactory } from './subagents.factory';
import { LINEA_SYSTEM_PROMPT } from '../prompts';

export interface LineaAgentState {
  workspaceId: string;
  userId: string;
  threadId?: string;
  messages: unknown[];
  lastSavedMemoryId?: string;
}

@Injectable()
export class AgentFactory {
  agent: DeepAgent | null = null;

  constructor(
    @Inject(LINEA_MODEL)
    private readonly model: BaseChatModel,
    @Inject(LINEA_STORE)
    private readonly store: PostgresStore,
    @Inject(LINEA_CHECKPOINTER)
    private readonly checkpointer: PostgresSaver,
    private readonly toolsFactory: ToolsFactory,
    private readonly subagentsFactory: SubagentsFactory,
  ) {}

  getAgent(): DeepAgent {
    if (!this.agent) {
      this.agent = this.createAgent();
    }
    return this.agent;
  }

  createAgent(): DeepAgent {
    const tools = this.toolsFactory.createAllTools();
    const subagents = this.subagentsFactory.createAllSubagents();

    return createDeepAgent({
      model: this.model,
      tools,
      systemPrompt: LINEA_SYSTEM_PROMPT,
      store: this.store,
      checkpointer: this.checkpointer,
      subagents,
    }) as unknown as DeepAgent;
  }
}
