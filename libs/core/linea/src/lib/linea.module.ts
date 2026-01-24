import { Inject, Module, OnApplicationBootstrap } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkspaceModule } from '@launchline/core-workspace';
import { IntegrationModule } from '@launchline/core-integration';
import { LineaFacade } from './linea.facade';
import { LineaQueue } from './linea.queue';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { ThreadResolver } from './thread.resolver';
import { LineaAdminResolver } from './linea-admin.resolver';
import {
  MemoryService,
  AgentPromptService,
  ToolsFactory,
  LinearSkillsFactory,
  SubagentsFactory,
  GraphsFactory,
  OnboardingGraphsFactory,
  LinearOnboardingGraphsService,
  GitHubOnboardingGraphsService,
  SlackOnboardingGraphsService,
  IdentityLinkingGraphsService,
  AgentFactory,
  SkillsFactory,
  TeamInsightsService,
  SandboxService,
  HeartbeatSettingsService,
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
import { LINEA_JOBS_QUEUE } from './jobs/linea-jobs.constants';
import { LineaJobsService } from './jobs/linea-jobs.service';
import { LineaJobsProcessor } from './jobs/linea-jobs.processor';

@Module({
  imports: [
    WorkspaceModule,
    IntegrationModule,
    BullModule.registerQueue({ name: LINEA_JOBS_QUEUE }),
  ],
  controllers: [AssistantController],
  providers: [
    // Models (ChatOpenAI, ChatAnthropic, Embeddings)
    ...modelProviders,
    // Persistence (Checkpointer, Store)
    ...persistenceProviders,
    // Memory service (needed by ToolsFactory)
    MemoryService,
    AgentPromptService,
    // Factories
    LinearSkillsFactory,
    SkillsFactory,
    ToolsFactory,
    SubagentsFactory,
    AgentFactory,
    GraphsFactory,
    LinearOnboardingGraphsService,
    GitHubOnboardingGraphsService,
    SlackOnboardingGraphsService,
    IdentityLinkingGraphsService,
    TeamInsightsService,
    SandboxService,
    HeartbeatSettingsService,
    OnboardingGraphsFactory,
    LineaJobsService,
    LineaJobsProcessor,
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
    LineaAdminResolver,
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
