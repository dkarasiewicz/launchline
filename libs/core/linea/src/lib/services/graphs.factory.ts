import { Inject, Injectable, Logger } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  LINEA_CHECKPOINTER,
  LINEA_STORE,
  LINEA_MODEL,
  LINEA_MODEL_FAST,
} from '../tokens';
import { MemoryService } from './memory.service';
import {
  ClassificationReasoningSchema,
  type RawEvent,
  type NormalizedEvent,
  type GraphContext,
  type SignalContext,
  type ClassificationReasoning,
  type InboxItemCandidate,
  type MemoryItem,
  type MemoryCategory,
  type MemoryNamespace,
} from '../types';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const IngestionStateAnnotation = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  correlationId: Annotation<string>(),
  rawEvents: Annotation<RawEvent[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  normalizedEvents: Annotation<NormalizedEvent[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  processingComplete: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
});

const ClassificationStateAnnotation = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  correlationId: Annotation<string>(),
  normalizedEvents: Annotation<NormalizedEvent[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  currentEventIndex: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  signalContexts: Annotation<SignalContext[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  classifications: Annotation<Map<string, ClassificationReasoning>>({
    reducer: (prev, next) => new Map([...prev, ...next]),
    default: () => new Map(),
  }),
  memoriesCreated: Annotation<MemoryItem[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

const InboxStateAnnotation = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  correlationId: Annotation<string>(),
  signalContexts: Annotation<SignalContext[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  classifications: Annotation<Map<string, ClassificationReasoning>>({
    reducer: (prev, next) => new Map([...prev, ...next]),
    default: () => new Map(),
  }),
  inboxCandidates: Annotation<InboxItemCandidate[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type IngestionState = typeof IngestionStateAnnotation.State;
type ClassificationState = typeof ClassificationStateAnnotation.State;
type InboxState = typeof InboxStateAnnotation.State;

@Injectable()
export class GraphsFactory {
  private readonly logger = new Logger(GraphsFactory.name);

  private ingestionGraph: ReturnType<typeof this.createIngestionGraph> | null =
    null;
  private classificationGraph: ReturnType<
    typeof this.createClassificationGraph
  > | null = null;
  private inboxGraph: ReturnType<typeof this.createInboxGraph> | null = null;

  constructor(
    @Inject(LINEA_CHECKPOINTER)
    private readonly checkpointer: PostgresSaver,
    @Inject(LINEA_STORE)
    private readonly store: PostgresStore,
    @Inject(LINEA_MODEL)
    private readonly model: BaseChatModel,
    @Inject(LINEA_MODEL_FAST)
    private readonly modelFast: BaseChatModel,
    private readonly memoryService: MemoryService,
  ) {}

  getIngestionGraph() {
    if (!this.ingestionGraph) {
      this.ingestionGraph = this.createIngestionGraph();
    }
    return this.ingestionGraph;
  }

  getClassificationGraph() {
    if (!this.classificationGraph) {
      this.classificationGraph = this.createClassificationGraph();
    }
    return this.classificationGraph;
  }

  getInboxGraph() {
    if (!this.inboxGraph) {
      this.inboxGraph = this.createInboxGraph();
    }
    return this.inboxGraph;
  }

  private createIngestionGraph() {
    const normalizeGitHub = async (
      state: IngestionState,
    ): Promise<Partial<IngestionState>> => {
      const events = state.rawEvents.filter((e) => e.source === 'github');
      const normalized = this.normalizeGitHubEvents(events, state.workspaceId);
      return { normalizedEvents: normalized };
    };

    const normalizeLinear = async (
      state: IngestionState,
    ): Promise<Partial<IngestionState>> => {
      const events = state.rawEvents.filter((e) => e.source === 'linear');
      const normalized = this.normalizeLinearEvents(events, state.workspaceId);
      return { normalizedEvents: normalized };
    };

    const normalizeSlack = async (
      state: IngestionState,
    ): Promise<Partial<IngestionState>> => {
      const events = state.rawEvents.filter((e) => e.source === 'slack');
      const normalized = this.normalizeSlackEvents(events, state.workspaceId);
      return { normalizedEvents: normalized };
    };

    const finalize = async (
      _state: IngestionState,
    ): Promise<Partial<IngestionState>> => {
      return { processingComplete: true };
    };

    const workflow = new StateGraph(IngestionStateAnnotation)
      .addNode('normalizeGitHub', normalizeGitHub)
      .addNode('normalizeLinear', normalizeLinear)
      .addNode('normalizeSlack', normalizeSlack)
      .addNode('finalize', finalize)
      .addEdge(START, 'normalizeGitHub')
      .addEdge('normalizeGitHub', 'normalizeLinear')
      .addEdge('normalizeLinear', 'normalizeSlack')
      .addEdge('normalizeSlack', 'finalize')
      .addEdge('finalize', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  private createClassificationGraph() {
    const memoryService = this.memoryService;
    const model = this.model;

    const extractContext = async (
      state: ClassificationState,
    ): Promise<Partial<ClassificationState>> => {
      const contexts: SignalContext[] = state.normalizedEvents.map((event) => ({
        signalId: event.id,
        workspaceId: state.workspaceId,
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
        prContext: this.extractPrContext(event),
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
      return { signalContexts: contexts };
    };

    const classify = async (
      state: ClassificationState,
    ): Promise<Partial<ClassificationState>> => {
      const classifications = new Map<string, ClassificationReasoning>();

      for (const context of state.signalContexts) {
        const classification = await this.classifySignal(context, model);

        classifications.set(context.signalId, classification);
      }

      return { classifications };
    };

    const persist = async (
      state: ClassificationState,
    ): Promise<Partial<ClassificationState>> => {
      const memoriesCreated: MemoryItem[] = [];
      const ctx: GraphContext = {
        workspaceId: state.workspaceId,
        userId: state.userId,
        correlationId: state.correlationId,
      };

      for (const [signalId, reasoning] of state.classifications) {
        const context = state.signalContexts.find(
          (c) => c.signalId === signalId,
        );
        if (!context) continue;

        for (const suggestion of reasoning.memorySuggestions) {
          if (suggestion.type !== 'save') continue;

          if (suggestion.importance < 0.3) continue;

          const memory = await memoryService.saveMemory(ctx, {
            namespace: suggestion.namespace,
            category: suggestion.category,
            content:
              suggestion.content ||
              context.rawText.body ||
              context.rawText.title,
            summary: context.rawText.title,
            importance: suggestion.importance,
            confidence: reasoning.classification.importance,
            sourceEventIds: [signalId],
            relatedEntityIds: [context.entity.id],
            relatedMemoryIds: [],
            entityRefs: {
              ticketIds: context.ticketContext
                ? [context.entity.id]
                : undefined,
              prIds: context.prContext ? [context.entity.id] : undefined,
            },
          });
          memoriesCreated.push(memory);

          this.logger.debug(
            `Created memory ${memory.id} (${suggestion.category}) for signal ${signalId}`,
          );
        }

        if (
          reasoning.classification.importance > 0.7 &&
          reasoning.classification.secondaryCategories.length > 0
        ) {
          for (const category of reasoning.classification.secondaryCategories) {
            const memory = await memoryService.saveMemory(ctx, {
              namespace: this.mapCategoryToNamespace(category),
              category,
              content: context.rawText.body || context.rawText.title,
              summary: `[${category}] ${context.rawText.title}`,
              importance: reasoning.classification.importance * 0.8, // Slightly lower for secondary
              confidence: reasoning.classification.importance,
              sourceEventIds: [signalId],
              relatedEntityIds: [context.entity.id],
              relatedMemoryIds: [],
              entityRefs: {},
            });
            memoriesCreated.push(memory);
          }
        }
      }

      return { memoriesCreated };
    };

    const workflow = new StateGraph(ClassificationStateAnnotation)
      .addNode('extractContext', extractContext)
      .addNode('classify', classify)
      .addNode('persist', persist)
      .addEdge(START, 'extractContext')
      .addEdge('extractContext', 'classify')
      .addEdge('classify', 'persist')
      .addEdge('persist', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  private createInboxGraph() {
    const detectBlockers = async (
      state: InboxState,
    ): Promise<Partial<InboxState>> => {
      const candidates: InboxItemCandidate[] = [];

      for (const context of state.signalContexts) {
        const reasoning = state.classifications.get(context.signalId);
        if (!reasoning?.blockerAnalysis?.isBlocker) continue;

        const { blockerAnalysis, classification } = reasoning;

        candidates.push({
          id: `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          workspaceId: state.workspaceId,
          type: 'blocker',
          priority: this.mapConfidenceToPriority(blockerAnalysis.confidence),
          title: `🚨 ${blockerAnalysis.blockerType || 'Blocker'}: ${context.entity.title.slice(0, 60)}`,
          summary:
            blockerAnalysis.evidence.length > 0
              ? blockerAnalysis.evidence[0]
              : context.rawText.title,
          confidence: blockerAnalysis.confidence,
          sourceMemoryIds: [],
          suggestedActions: classification.suggestedActions
            .filter((a) => a.priority === 'immediate')
            .map((a) => a.action),
          requiresApproval: classification.suggestedActions.some(
            (a) => a.requiresApproval,
          ),
          entityRefs: {
            ticketIds: blockerAnalysis.affectedEntities.filter((e) =>
              e.startsWith('ticket-'),
            ),
            prIds: blockerAnalysis.affectedEntities.filter((e) =>
              e.startsWith('pr-'),
            ),
          },
          createdAt: new Date(),
        });
      }

      return { inboxCandidates: candidates };
    };

    const detectDrift = async (
      state: InboxState,
    ): Promise<Partial<InboxState>> => {
      const candidates: InboxItemCandidate[] = [];

      for (const context of state.signalContexts) {
        const reasoning = state.classifications.get(context.signalId);
        if (!reasoning?.driftAnalysis?.hasDrift) continue;

        const { driftAnalysis, classification } = reasoning;

        candidates.push({
          id: `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          workspaceId: state.workspaceId,
          type: 'drift',
          priority:
            driftAnalysis.driftType === 'scope_creep' ? 'high' : 'medium',
          title: `⚠️ ${driftAnalysis.driftType}: ${context.entity.title.slice(0, 60)}`,
          summary:
            driftAnalysis.previousState && driftAnalysis.currentState
              ? `Changed from "${driftAnalysis.previousState}" to "${driftAnalysis.currentState}"`
              : driftAnalysis.evidence[0] || context.rawText.title,
          confidence: classification.importance,
          sourceMemoryIds: [],
          suggestedActions: classification.suggestedActions.map(
            (a) => a.action,
          ),
          requiresApproval: driftAnalysis.driftType === 'scope_creep',
          entityRefs: {},
          createdAt: new Date(),
        });
      }

      return { inboxCandidates: candidates };
    };

    const detectRisks = async (
      state: InboxState,
    ): Promise<Partial<InboxState>> => {
      const candidates: InboxItemCandidate[] = [];

      for (const context of state.signalContexts) {
        const reasoning = state.classifications.get(context.signalId);
        if (!reasoning?.qualityAnalysis) continue;

        const { qualityAnalysis, classification } = reasoning;
        const highSeverityConcerns = qualityAnalysis.concerns.filter(
          (c) => c.severity === 'high',
        );

        if (highSeverityConcerns.length === 0) continue;

        candidates.push({
          id: `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          workspaceId: state.workspaceId,
          type: 'risk',
          priority: 'high',
          title: `⚡ Quality Risk: ${context.entity.title.slice(0, 60)}`,
          summary: highSeverityConcerns
            .map((c) => `${c.type}: ${c.evidence}`)
            .join('; '),
          confidence: classification.importance,
          sourceMemoryIds: [],
          suggestedActions: [
            ...highSeverityConcerns.map((c) => `Address ${c.type} concern`),
            ...classification.suggestedActions.map((a) => a.action),
          ],
          requiresApproval: highSeverityConcerns.some(
            (c) => c.type === 'security' || c.type === 'breaking_change',
          ),
          entityRefs: {
            prIds: context.prContext ? [context.entity.id] : undefined,
          },
          createdAt: new Date(),
        });
      }

      return { inboxCandidates: candidates };
    };

    const detectUpdates = async (
      state: InboxState,
    ): Promise<Partial<InboxState>> => {
      const candidates: InboxItemCandidate[] = [];

      for (const context of state.signalContexts) {
        const reasoning = state.classifications.get(context.signalId);
        if (!reasoning) continue;

        if (
          reasoning.blockerAnalysis?.isBlocker ||
          reasoning.driftAnalysis?.hasDrift ||
          reasoning.qualityAnalysis?.concerns.some((c) => c.severity === 'high')
        ) {
          continue;
        }

        const { updateAnalysis, classification } = reasoning;

        if (!updateAnalysis.shouldNotify || !updateAnalysis.isSignificant)
          continue;

        candidates.push({
          id: `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          workspaceId: state.workspaceId,
          type: 'update',
          priority: updateAnalysis.category === 'decision' ? 'high' : 'medium',
          title: `📋 ${updateAnalysis.category}: ${context.entity.title.slice(0, 60)}`,
          summary: context.rawText.title,
          confidence: classification.importance,
          sourceMemoryIds: [],
          suggestedActions: classification.suggestedActions
            .filter((a) => a.priority !== 'later')
            .map((a) => a.action),
          requiresApproval: false,
          entityRefs: {},
          createdAt: new Date(),
        });
      }

      return { inboxCandidates: candidates };
    };

    const workflow = new StateGraph(InboxStateAnnotation)
      .addNode('detectBlockers', detectBlockers)
      .addNode('detectDrift', detectDrift)
      .addNode('detectRisks', detectRisks)
      .addNode('detectUpdates', detectUpdates)
      .addEdge(START, 'detectBlockers')
      .addEdge('detectBlockers', 'detectDrift')
      .addEdge('detectDrift', 'detectRisks')
      .addEdge('detectRisks', 'detectUpdates')
      .addEdge('detectUpdates', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  private normalizeGitHubEvents(
    events: RawEvent[],
    workspaceId: string,
  ): NormalizedEvent[] {
    return events.map((event) => {
      const payload = event.payload;
      const pr = payload['pull_request'] as Record<string, unknown> | undefined;
      const issue = payload['issue'] as Record<string, unknown> | undefined;
      const linea = payload['linea'] as
        | {
            pr?: Record<string, unknown>;
            prSummary?: string;
            prContext?: Record<string, unknown>;
            issue?: Record<string, unknown>;
            commit?: Record<string, unknown>;
            commitSummary?: string;
            branch?: string;
          }
        | undefined;

      const repo = payload['repository'] as Record<string, unknown> | undefined;
      const repoFullName =
        (repo?.['full_name'] as string | undefined) ||
        (repo?.['name'] as string | undefined);

      const commit =
        (linea?.commit as Record<string, unknown> | undefined) ||
        (payload['head_commit'] as Record<string, unknown> | undefined);

      const baseMetadata = {
        ...payload,
        url:
          (pr?.['html_url'] as string | undefined) ||
          (issue?.['html_url'] as string | undefined) ||
          (commit?.['html_url'] as string | undefined),
        repo: repoFullName,
        linea,
      };

      if (pr) {
        const title = (pr['title'] as string) || 'GitHub PR';
        const body = (pr['body'] as string) || '';
        const summary = linea?.prSummary ? `\n\n${linea.prSummary}` : '';
        return {
          id: event.id,
          workspaceId,
          source: 'github' as const,
          eventType: event.eventType,
          entityId: `gh-pr-${pr['number']}`,
          entityType: 'pr',
          title,
          description: `${body}${summary}`.trim(),
          status: (pr['state'] as string) || 'unknown',
          assignee: (
            (pr['assignee'] as { login: string } | undefined) || undefined
          )?.login,
          metadata: baseMetadata,
          timestamp: event.timestamp,
        };
      }

      if (issue) {
        const title = (issue['title'] as string) || 'GitHub Issue';
        const body = (issue['body'] as string) || '';
        const issueDetails = linea?.issue as Record<string, unknown> | undefined;
        const issueSummary = issueDetails?.['body']
          ? `\n\n${issueDetails['body'] as string}`
          : '';
        return {
          id: event.id,
          workspaceId,
          source: 'github' as const,
          eventType: event.eventType,
          entityId: `gh-issue-${issue['number']}`,
          entityType: 'issue',
          title,
          description: `${body}${issueSummary}`.trim(),
          status: (issue['state'] as string) || 'unknown',
          assignee: (
            (issue['assignee'] as { login: string } | undefined) || undefined
          )?.login,
          metadata: baseMetadata,
          timestamp: event.timestamp,
        };
      }

      if (commit) {
        const sha =
          (commit['sha'] as string | undefined) ||
          (commit['id'] as string | undefined) ||
          event.id;
        const message =
          (commit['message'] as string | undefined) || 'Commit update';
        const summary = linea?.commitSummary
          ? `\n\n${linea.commitSummary}`
          : '';
        return {
          id: event.id,
          workspaceId,
          source: 'github' as const,
          eventType: event.eventType,
          entityId: `gh-commit-${sha}`,
          entityType: 'commit',
          title: message,
          description: summary.trim(),
          status: 'pushed',
          assignee: undefined,
          metadata: baseMetadata,
          timestamp: event.timestamp,
        };
      }

      return {
        id: event.id,
        workspaceId,
        source: 'github' as const,
        eventType: event.eventType,
        entityId: event.id,
        entityType: 'issue',
        title: 'GitHub Event',
        description: '',
        status: 'unknown',
        metadata: baseMetadata,
        timestamp: event.timestamp,
      };
    });
  }

  private normalizeLinearEvents(
    events: RawEvent[],
    workspaceId: string,
  ): NormalizedEvent[] {
    return events.map((event) => {
      const payload = event.payload;
      const data = payload['data'] as Record<string, unknown> | undefined;

      return {
        id: event.id,
        workspaceId,
        source: 'linear' as const,
        eventType: event.eventType,
        entityId: (data?.['id'] as string) || event.id,
        entityType: 'ticket',
        title: (data?.['title'] || 'Linear Event') as string,
        description: (data?.['description'] || '') as string,
        status:
          (data?.['state'] as { name: string } | undefined)?.name || 'unknown',
        assignee: (data?.['assignee'] as { name: string } | undefined)?.name,
        metadata: payload,
        timestamp: event.timestamp,
      };
    });
  }

  private normalizeSlackEvents(
    events: RawEvent[],
    workspaceId: string,
  ): NormalizedEvent[] {
    return events.map((event) => {
      const payload = event.payload;
      const eventData = payload['event'] as Record<string, unknown> | undefined;

      return {
        id: event.id,
        workspaceId,
        source: 'slack' as const,
        eventType: event.eventType,
        entityId: (eventData?.['ts'] as string) || event.id,
        entityType: 'message',
        title: 'Slack Message',
        description: (eventData?.['text'] || '') as string,
        status: 'active',
        metadata: payload,
        timestamp: event.timestamp,
      };
    });
  }

  private extractPrContext(event: NormalizedEvent): SignalContext['prContext'] {
    if (event.source !== 'github' || event.entityType !== 'pr') {
      return undefined;
    }

    const linea = event.metadata?.['linea'] as
      | { prContext?: Record<string, unknown>; pr?: Record<string, unknown> }
      | undefined;
    const prContext = linea?.prContext as
      | {
          filesChanged?: number;
          additions?: number;
          deletions?: number;
          hasTests?: boolean;
          hasBreakingChange?: boolean;
          hasSecurityRelevant?: boolean;
          touchesConfig?: boolean;
          touchesInfra?: boolean;
          touchesApi?: boolean;
          hasDependencyUpdate?: boolean;
        }
      | undefined;

    if (!prContext) {
      return undefined;
    }

    const prDetails = linea?.pr as
      | { labels?: string[]; reviewers?: string[] }
      | undefined;

    return {
      filesChanged: prContext.filesChanged || 0,
      additions: prContext.additions || 0,
      deletions: prContext.deletions || 0,
      reviewers: prDetails?.reviewers || [],
      labels: prDetails?.labels || [],
      isMerged: Boolean((linea?.pr as { merged?: boolean })?.merged),
      isDraft: Boolean((linea?.pr as { draft?: boolean })?.draft),
      patterns: {
        hasTests: Boolean(prContext.hasTests),
        touchesConfig: Boolean(prContext.touchesConfig),
        touchesInfra: Boolean(prContext.touchesInfra),
        touchesApi: Boolean(prContext.touchesApi),
        hasBreakingChange: Boolean(prContext.hasBreakingChange),
        hasSecurityRelevant: Boolean(prContext.hasSecurityRelevant),
        hasDependencyUpdate: Boolean(prContext.hasDependencyUpdate),
      },
    };
  }

  private async classifySignal(
    context: SignalContext,
    model: BaseChatModel,
  ): Promise<ClassificationReasoning> {
    const structuredModel = model.withStructuredOutput(
      ClassificationReasoningSchema,
      {
        name: 'classify_signal',
      },
    );

    const systemPrompt = `You are an expert at analyzing software development signals (PRs, tickets, messages) for a PM assistant called Linea.

Your job is to help PMs stay on top of what matters by detecting:
1. **Blockers** - Anything preventing progress. Look for:
   - Explicit blocker mentions ("blocked by", "waiting on", "can't proceed")
   - Dependencies that aren't resolved
   - Missing requirements or decisions
   - Urgent/critical priority items that haven't moved

2. **Drift** - Changes that might derail plans:
   - Scope changes or feature creep
   - Priority changes without explanation
   - Work that's been "in progress" too long (stalled)
   - Timeline slips

3. **Significant Updates** - Things the PM should know:
   - Important decisions made
   - Major progress on key features
   - New risks or concerns raised
   - Team dynamics issues

4. **Quality Concerns** (for PRs):
   - Security implications
   - Breaking changes
   - Missing tests
   - Large/risky changes

Return structured analysis with evidence. Be aggressive about detecting blockers - it's better to flag something that turns out fine than to miss a real blocker.

For memory suggestions, focus on things that provide future context:
- Decisions and their rationale
- Who owns what
- Blockers and how they were resolved
- Team preferences and patterns`;

    const userPrompt = `Analyze this ${context.source} ${context.eventType} signal:

Title: ${context.rawText.title}
${context.rawText.body ? `Body: ${context.rawText.body}` : ''}

Entity Type: ${context.entity.type}
Status: ${context.entity.status || 'unknown'}

${
  context.prContext
    ? `PR Context:
- Files changed: ${context.prContext.filesChanged}
- Additions: ${context.prContext.additions}
- Deletions: ${context.prContext.deletions}
- Has tests: ${context.prContext.patterns.hasTests}
- Breaking change: ${context.prContext.patterns.hasBreakingChange}
- Security relevant: ${context.prContext.patterns.hasSecurityRelevant}`
    : ''
}

${
  context.ticketContext
    ? `Ticket Context:
- Priority: ${context.ticketContext.priority}
- Labels: ${context.ticketContext.labels.join(', ')}`
    : ''
}

References:
- Mentioned users: ${context.references.mentionedUsers.join(', ') || 'none'}
- Blocker mentions: ${context.references.blockerMentions.join(', ') || 'none'}
- Decision mentions: ${context.references.decisionMentions.join(', ') || 'none'}`;

    try {
      const result = await structuredModel.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      this.logger.debug(
        `Classified signal ${context.signalId}: ${result.classification.primaryCategory}`,
      );

      return result;
    } catch (error) {
      this.logger.warn(
        `LLM classification failed for ${context.signalId}, using fallback: ${error}`,
      );

      return this.fallbackClassification(context);
    }
  }

  private fallbackClassification(
    context: SignalContext,
  ): ClassificationReasoning {
    const text =
      `${context.rawText.title} ${context.rawText.body}`.toLowerCase();

    const isBlocker =
      text.includes('block') ||
      text.includes('urgent') ||
      text.includes('critical');
    const isDecision =
      text.includes('decision') ||
      text.includes('decided') ||
      text.includes('agreed');

    const primaryCategory: MemoryCategory = isBlocker
      ? 'blocker'
      : isDecision
        ? 'decision'
        : 'progress';

    return {
      blockerAnalysis: {
        isBlocker,
        blockerType: isBlocker ? 'technical' : null,
        confidence: isBlocker ? 0.8 : 0.1,
        evidence: [],
        affectedEntities: [],
      },
      driftAnalysis: {
        hasDrift: false,
        driftType: null,
        previousState: null,
        currentState: null,
        evidence: [],
      },
      updateAnalysis: {
        isSignificant: true,
        category: 'progress',
        shouldNotify: isBlocker,
        suggestedRecipients: [],
      },
      qualityAnalysis: null,
      classification: {
        primaryCategory,
        secondaryCategories: [],
        importance: isBlocker ? 0.9 : 0.5,
        suggestedActions: [],
      },
      memorySuggestions: [
        {
          type: 'save',
          namespace: this.mapCategoryToNamespace(primaryCategory),
          category: primaryCategory,
          content: context.rawText.title,
          importance: isBlocker ? 0.9 : 0.5,
        },
      ],
    };
  }

  private mapCategoryToNamespace(category: MemoryCategory): MemoryNamespace {
    if (category === 'blocker') return 'blocker';
    if (category === 'decision') return 'decision';

    return 'ticket';
  }

  private mapConfidenceToPriority(
    confidence: number,
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (confidence >= 0.9) return 'critical';
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }
}
