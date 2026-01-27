import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ReactAgent } from 'langchain';
import { LINEA_AGENT } from './tokens';
import { MemoryService, GraphsFactory } from './services';
import { AssistantService } from './assistant.service';
import type {
  GraphContext,
  SourceType,
  RawEvent,
  MemoryItem,
  MemorySearchQuery,
  ProcessWebhookInput,
  ProcessWebhookResult,
  InboxItemCandidate,
  InboxItemType,
  InboxPriority,
} from './types';

@Injectable()
export class LineaFacade {
  private readonly logger = new Logger(LineaFacade.name);

  constructor(
    @Inject(LINEA_AGENT)
    private readonly agent: ReactAgent,
    private readonly memoryService: MemoryService,
    private readonly graphsFactory: GraphsFactory,
    private readonly assistantService: AssistantService,
  ) {}

  async processWebhook(
    input: ProcessWebhookInput,
  ): Promise<ProcessWebhookResult> {
    const ctx: GraphContext = {
      workspaceId: input.workspaceId,
      userId: input.userId,
      correlationId: `webhook-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };

    const rawEvent: RawEvent = {
      id: `${input.source}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      workspaceId: input.workspaceId,
      source: input.source,
      eventType: input.eventType,
      payload: input.payload,
      timestamp: new Date(),
      receivedAt: new Date(),
    };

    this.logger.log(
      `[LineaFacade] Processing ${input.source}/${input.eventType} for workspace ${input.workspaceId}`,
    );

    // 1. Ingestion: Normalize raw events
    const ingestionGraph = this.graphsFactory.getIngestionGraph();
    const ingestionResult = await ingestionGraph.invoke({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      rawEvents: [rawEvent],
    });

    const normalizedEvents = ingestionResult.normalizedEvents;

    this.logger.log(
      `[LineaFacade] Normalized ${normalizedEvents.length} events`,
    );

    if (normalizedEvents.length === 0) {
      return {
        normalizedEvents: [],
        memoriesCreated: [],
        inboxItems: [],
      };
    }

    // 2. Classification: Classify and create memories
    const classificationGraph = this.graphsFactory.getClassificationGraph();
    const classificationResult = await classificationGraph.invoke({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      normalizedEvents,
    });

    const memoriesCreated = classificationResult.memoriesCreated;
    const classifications = classificationResult.classifications;

    this.logger.log(`[LineaFacade] Created ${memoriesCreated.length} memories`);

    // 3. Build signal contexts for inbox generation
    const signalContexts = normalizedEvents.map((event) => ({
      signalId: event.id,
      workspaceId: ctx.workspaceId,
      source: event.source,
      eventType: event.eventType,
      timestamp: event.timestamp,
      entity: {
        id: event.entityId,
        type: event.entityType,
        title: event.title,
        description: event.description,
        status: event.status || 'unknown',
        url: event.metadata?.['url'] as string | undefined,
      },
      teamContext: {
        teamId: (event.metadata?.['team'] as { id: string } | undefined)?.id,
        teamName: (event.metadata?.['team'] as { name: string } | undefined)
          ?.name,
        projectId: (event.metadata?.['project'] as { id: string } | undefined)
          ?.id,
      },
      references: {
        mentionedUsers: [],
        linkedIssues: [],
        linkedPRs: [],
        blockerMentions: [],
        decisionMentions: [],
      },
      rawText: {
        title: event.title,
        body: event.description,
      },
    }));

    // 4. Inbox Generation
    const inboxGraph = this.graphsFactory.getInboxGraph();
    const inboxResult = await inboxGraph.invoke({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      signalContexts,
      classifications,
    });

    const inboxItems = inboxResult.inboxCandidates;

    this.logger.log(`[LineaFacade] Generated ${inboxItems.length} inbox items`);

    return {
      normalizedEvents,
      memoriesCreated,
      inboxItems,
    };
  }

  async processWebhookBatch(
    workspaceId: string,
    userId: string,
    events: Array<{
      source: SourceType;
      eventType: string;
      payload: Record<string, unknown>;
    }>,
  ): Promise<ProcessWebhookResult> {
    const ctx: GraphContext = {
      workspaceId,
      userId,
      correlationId: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };

    // Create raw events
    const rawEvents: RawEvent[] = events.map((e, i) => ({
      id: `${e.source}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
      workspaceId,
      source: e.source,
      eventType: e.eventType,
      payload: e.payload,
      timestamp: new Date(),
      receivedAt: new Date(),
    }));

    // Run through pipeline
    const ingestionGraph = this.graphsFactory.getIngestionGraph();
    const ingestionResult = await ingestionGraph.invoke({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      rawEvents,
    });

    const normalizedEvents = ingestionResult.normalizedEvents;

    if (normalizedEvents.length === 0) {
      return { normalizedEvents: [], memoriesCreated: [], inboxItems: [] };
    }

    const classificationGraph = this.graphsFactory.getClassificationGraph();
    const classificationResult = await classificationGraph.invoke({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      normalizedEvents,
    });

    const signalContexts = normalizedEvents.map((event) => ({
      signalId: event.id,
      workspaceId: ctx.workspaceId,
      source: event.source,
      eventType: event.eventType,
      timestamp: event.timestamp,
      entity: {
        id: event.entityId,
        type: event.entityType,
        title: event.title,
        description: event.description,
        status: event.status || 'unknown',
      },
      teamContext: {},
      references: {
        mentionedUsers: [],
        linkedIssues: [],
        linkedPRs: [],
        blockerMentions: [],
        decisionMentions: [],
      },
      rawText: {
        title: event.title,
        body: event.description,
      },
    }));

    const inboxGraph = this.graphsFactory.getInboxGraph();
    const inboxResult = await inboxGraph.invoke({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      signalContexts,
      classifications: classificationResult.classifications,
    });

    return {
      normalizedEvents,
      memoriesCreated: classificationResult.memoriesCreated,
      inboxItems: inboxResult.inboxCandidates,
    };
  }

  async searchMemories(query: MemorySearchQuery): Promise<MemoryItem[]> {
    return this.memoryService.searchMemories(query);
  }

  async getRecentBlockers(
    workspaceId: string,
    limit = 10,
  ): Promise<MemoryItem[]> {
    return this.memoryService.getRecentBlockers(workspaceId, limit);
  }

  async getRecentDecisions(
    workspaceId: string,
    limit = 10,
  ): Promise<MemoryItem[]> {
    return this.memoryService.getRecentDecisions(workspaceId, limit);
  }

  async saveMemory(
    ctx: GraphContext,
    memory: Omit<MemoryItem, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>,
  ): Promise<MemoryItem> {
    return this.memoryService.saveMemory(ctx, memory);
  }

  async getThreadState(threadId: string) {
    return this.agent.getState({
      configurable: { thread_id: threadId },
    });
  }

  async createInboxThread(input: {
    workspaceId: string;
    userId: string;
    type: InboxItemType;
    priority: InboxPriority;
    title: string;
    summary: string;
    suggestedActions: string[];
    sourceMemoryIds: string[];
    entityRefs: {
      ticketIds?: string[];
      prIds?: string[];
      userIds?: string[];
      teamIds?: string[];
    };
  }): Promise<{ remoteId: string }> {
    const candidate: InboxItemCandidate = {
      id: `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      workspaceId: input.workspaceId,
      type: input.type,
      priority: input.priority,
      title: input.title,
      summary: input.summary,
      confidence: 1,
      sourceMemoryIds: input.sourceMemoryIds,
      suggestedActions: input.suggestedActions,
      requiresApproval: false,
      entityRefs: input.entityRefs,
      createdAt: new Date(),
    };

    return this.assistantService.createInboxThread(
      input.workspaceId,
      input.userId,
      candidate,
    );
  }
}
