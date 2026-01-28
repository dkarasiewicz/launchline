import { Inject, Module, OnApplicationBootstrap } from '@nestjs/common';
import { WorkspaceModule } from '@launchline/core-workspace';
import { IntegrationModule } from '@launchline/core-integration';
import { LineaFacade } from './linea.facade';
import { LineaQueue } from './linea.queue';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { ThreadResolver } from './thread.resolver';
import {
  MemoryService,
  ToolsFactory,
  SubagentsFactory,
  GraphsFactory,
  OnboardingGraphsFactory,
  AgentFactory,
  MCPToolsFactory,
} from './services';
import {
  LINEA_AGENT,
  LINEA_TOOLS,
  LINEA_SUBAGENTS,
  LINEA_STORE,
  LINEA_CHECKPOINTER,
} from './tokens';
import { modelProviders, persistenceProviders } from './providers';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

@Module({
  imports: [WorkspaceModule, IntegrationModule],
  controllers: [AssistantController],
  providers: [
    // Models (ChatOpenAI, ChatAnthropic, Embeddings)
    ...modelProviders,
    // Persistence (Checkpointer, Store)
    ...persistenceProviders,
    // Memory service (needed by ToolsFactory)
    MemoryService,
    // Factories
    ToolsFactory,
    MCPToolsFactory,
    SubagentsFactory,
    AgentFactory,
    GraphsFactory,
    OnboardingGraphsFactory,
    // Tools token (from ToolsFactory)
    {
      provide: LINEA_TOOLS,
      useFactory: (factory: ToolsFactory) => factory.createAllTools(),
      inject: [ToolsFactory],
    },
    // Subagents token (from SubagentsFactory)
    {
      provide: LINEA_SUBAGENTS,
      useFactory: (factory: SubagentsFactory) => factory.createAllSubagents(),
      inject: [SubagentsFactory],
    },
    // Agent token (from AgentFactory)
    {
      provide: LINEA_AGENT,
      useFactory: (factory: AgentFactory) => factory.getAgent(),
      inject: [AgentFactory],
    },
    // Application services
    AssistantService,
    // Queue handler
    LineaQueue,
    // GraphQL Resolvers
    ThreadResolver,
    // Facade (public API for other domains)
    LineaFacade,
  ],
  exports: [LineaFacade],
})
export class LineaModule implements OnApplicationBootstrap {
  constructor(
    @Inject(LINEA_STORE)
    private readonly store: PostgresStore,
    @Inject(LINEA_CHECKPOINTER)
    private readonly checkpointer: PostgresSaver,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.store.setup();
    await this.checkpointer.setup();
  }
}
