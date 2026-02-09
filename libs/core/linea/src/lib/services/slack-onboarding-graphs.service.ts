import { Inject, Injectable, Logger } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { LINEA_CHECKPOINTER, LINEA_MODEL_ANALYSIS } from '../tokens';
import { MemoryService } from './memory.service';
import {
  LLMObservationsSchema,
  type GraphContext,
  type LLMObservation,
  type MemoryNamespace,
} from '../types';
import { SlackService } from '@launchline/core-integration';

const SlackOnboardingStateAnnotation = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  correlationId: Annotation<string>(),
  slackToken: Annotation<string>(),
  slackWorkspaceId: Annotation<string>(),
  channels: Annotation<SlackChannel[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  members: Annotation<SlackMember[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  recentMessages: Annotation<Map<string, SlackMessage[]>>({
    reducer: (_, next) => next,
    default: () => new Map(),
  }),
  channelInsights: Annotation<ChannelInsight[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  teamInsights: Annotation<SlackTeamInsight[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  topicSummaries: Annotation<TopicSummary[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  llmObservations: Annotation<LLMObservation[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  memoriesCreated: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  phase: Annotation<OnboardingPhase>({
    reducer: (_, next) => next,
    default: () => 'fetching',
  }),
});

type SlackOnboardingState = typeof SlackOnboardingStateAnnotation.State;

type OnboardingPhase =
  | 'fetching'
  | 'analyzing'
  | 'llm_analysis'
  | 'detect_inbox'
  | 'creating_memories'
  | 'complete'
  | 'error';

interface SlackChannel {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  isPrivate: boolean;
  memberCount: number;
}

interface SlackMember {
  id: string;
  name: string;
  realName: string;
  email?: string;
  isAdmin: boolean;
}

interface SlackMessage {
  ts: string;
  user: string;
  text: string;
  channel: string;
}

interface ChannelInsight {
  channelId: string;
  channelName: string;
  activityLevel: 'high' | 'medium' | 'low';
  keyTopics: string[];
}

interface SlackTeamInsight {
  type: 'communication_hub' | 'active_contributor' | 'expert';
  memberId: string;
  description: string;
}

interface TopicSummary {
  channelId: string;
  channelName: string;
  keyTopics: string[];
  summary: string;
}

@Injectable()
export class SlackOnboardingGraphsService {
  private readonly logger = new Logger(SlackOnboardingGraphsService.name);
  private graph: ReturnType<typeof this.createSlackOnboardingGraph> | null =
    null;

  constructor(
    @Inject(LINEA_CHECKPOINTER)
    private readonly checkpointer: PostgresSaver,
    @Inject(LINEA_MODEL_ANALYSIS)
    private readonly modelAnalysis: BaseChatModel,
    private readonly memoryService: MemoryService,
    private readonly slackService: SlackService,
  ) {}

  getGraph() {
    if (!this.graph) {
      this.graph = this.createSlackOnboardingGraph();
    }

    return this.graph;
  }
  private createSlackOnboardingGraph() {
    const memoryService = this.memoryService;
    const model = this.modelAnalysis;

    const fetchChannels = async (
      state: SlackOnboardingState,
    ): Promise<Partial<SlackOnboardingState>> => {
      try {
        this.logger.debug(
          { slackWorkspaceId: state.slackWorkspaceId },
          'Fetching Slack channels',
        );

        const channels = await this.slackService.listChannels(
          state.slackToken,
        );

        this.logger.debug(
          { channels: channels.length },
          'Fetched Slack channels',
        );

        return { channels, phase: 'fetching' };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch channels: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const fetchMembers = async (
      _state: SlackOnboardingState,
    ): Promise<Partial<SlackOnboardingState>> => {
      try {
        const members = await this.slackService.listUsers(_state.slackToken);
        this.logger.debug({ members: members.length }, 'Fetched Slack members');
        return { members };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch members: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const fetchMessages = async (
      state: SlackOnboardingState,
    ): Promise<Partial<SlackOnboardingState>> => {
      try {
        const recentMessages = new Map<string, SlackMessage[]>();
        const channelsToFetch = state.channels
          .slice()
          .sort((a, b) => b.memberCount - a.memberCount)
          .slice(0, 8);

        for (const channel of channelsToFetch) {
          try {
            const messages = await this.slackService.fetchRecentMessages(
              state.slackToken,
              channel.id,
              30,
            );
            recentMessages.set(channel.id, messages);
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            const notInChannel =
              errorMessage.includes('not_in_channel') ||
              (typeof err === 'object' &&
                err !== null &&
                'data' in err &&
                typeof (err as { data?: { error?: string } }).data?.error ===
                  'string' &&
                (err as { data?: { error?: string } }).data?.error ===
                  'not_in_channel');

            if (notInChannel && !channel.isPrivate) {
              try {
                await this.slackService.joinChannel(
                  state.slackToken,
                  channel.id,
                );
                const messages = await this.slackService.fetchRecentMessages(
                  state.slackToken,
                  channel.id,
                  30,
                );
                recentMessages.set(channel.id, messages);
                continue;
              } catch (joinErr) {
                this.logger.warn(
                  { err: joinErr, channelId: channel.id },
                  'Failed to join Slack channel for history fetch',
                );
              }
            }

            this.logger.warn(
              { err, channelId: channel.id },
              'Failed to fetch Slack channel history',
            );
          }
        }

        return { recentMessages, phase: 'analyzing' };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch messages: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const analyze = async (
      state: SlackOnboardingState,
    ): Promise<Partial<SlackOnboardingState>> => {
      const channelInsights: ChannelInsight[] = [];
      const teamInsights: SlackTeamInsight[] = [];
      const topicSummaries: TopicSummary[] = [];

      for (const channel of state.channels) {
        const messages = state.recentMessages.get(channel.id) || [];
        channelInsights.push({
          channelId: channel.id,
          channelName: channel.name,
          activityLevel:
            messages.length > 50
              ? 'high'
              : messages.length > 10
                ? 'medium'
                : 'low',
          keyTopics: [],
        });
      }

      return {
        channelInsights,
        teamInsights,
        topicSummaries,
        phase: 'llm_analysis',
      };
    };

    const llmAnalysis = async (
      state: SlackOnboardingState,
    ): Promise<Partial<SlackOnboardingState>> => {
      try {
        if (state.channels.length === 0) {
          return { llmObservations: [], phase: 'creating_memories' };
        }

        const structuredModel = model.withStructuredOutput(
          LLMObservationsSchema,
          { name: 'analyze_slack_workspace' },
        );

        const result = await structuredModel.invoke([
          new SystemMessage(
            `You are analyzing a team's Slack workspace. Provide structured insights about:
1. Team dynamics - communication patterns, key communicators
2. Channel usage - which channels are most active, purposes
3. Risks - communication gaps, silos, or concerns
4. Recommendations - actionable improvements

Return multiple observations with appropriate types and importance scores.`,
          ),
          new HumanMessage(
            `Channels: ${state.channels.map((c) => `#${c.name} (${c.memberCount} members)`).join(', ')}
Members: ${state.members.length}
Active channels: ${state.channelInsights.filter((c) => c.activityLevel === 'high').length}`,
          ),
        ]);

        return {
          llmObservations: result.observations,
          phase: 'creating_memories',
        };
      } catch (err) {
        this.logger.warn({ err }, 'LLM analysis failed for Slack onboarding');
        return {
          errors: [
            `LLM analysis failed: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const createMemories = async (
      state: SlackOnboardingState,
    ): Promise<Partial<SlackOnboardingState>> => {
      const memoriesCreated: string[] = [];
      const ctx: GraphContext = {
        workspaceId: state.workspaceId,
        userId: state.userId,
        correlationId: state.correlationId,
      };

      try {
        const topChannels = state.channels
          .slice()
          .sort((a, b) => b.memberCount - a.memberCount)
          .slice(0, 5)
          .map((channel) => `#${channel.name}`);
        const activeChannels = state.channelInsights
          .filter((channel) => channel.activityLevel === 'high')
          .slice(0, 5)
          .map((channel) => `#${channel.channelName}`);
        const overviewSummary =
          activeChannels.length > 0
            ? `active ${activeChannels.slice(0, 3).join(', ')}`
            : 'no high-activity channels yet';

        const overviewMemory = await memoryService.saveMemory(ctx, {
          namespace: 'team' as MemoryNamespace,
          category: 'insight',
          content: JSON.stringify({
            source: 'onboarding',
            platform: 'slack',
            kind: 'overview',
            counts: {
              channels: state.channels.length,
              members: state.members.length,
              activeChannels: activeChannels.length,
            },
            topChannels,
            activeChannels,
            channelInsights: state.channelInsights,
            teamInsights: state.teamInsights,
            topicSummaries: state.topicSummaries,
          }),
          summary: `[Onboarding][Slack] Overview: ${state.channels.length} channels, ${state.members.length} members, ${overviewSummary}`,
          importance: 0.8,
          confidence: 1,
          sourceEventIds: [],
          relatedEntityIds: [],
          relatedMemoryIds: [],
          entityRefs: {},
        });
        memoriesCreated.push(overviewMemory.id);

        if (state.channels.length > 0) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'team' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              source: 'onboarding',
              platform: 'slack',
              kind: 'workspace',
              channels: state.channels,
              members: state.members,
            }),
            summary: `[Onboarding][Slack] Workspace: ${state.channels.length} channels`,
            importance: 0.7,
            confidence: 1,
            sourceEventIds: [],
            relatedEntityIds: [],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
        }

        for (const obs of state.llmObservations) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'team' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              source: 'onboarding',
              platform: 'slack',
              kind: 'observation',
              title: obs.title,
              observation: obs.observation,
              relatedEntities: obs.relatedEntities || [],
            }),
            summary: `[Onboarding][Slack] ${obs.title}`,
            importance: obs.importance,
            confidence: 0.8,
            sourceEventIds: [],
            relatedEntityIds: obs.relatedEntities || [],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
        }

        if (memoriesCreated.length > 0) {
          const memoryIds = [...memoriesCreated];
          const indexMemory = await memoryService.saveMemory(ctx, {
            namespace: 'workspace' as MemoryNamespace,
            category: 'settings',
            content: JSON.stringify({
              source: 'onboarding',
              platform: 'slack',
              kind: 'index',
              runId: ctx.correlationId,
              memoryIds,
            }),
            summary: `[Onboarding][Slack] Index: ${memoryIds.length} memories`,
            importance: 0.2,
            confidence: 1,
            sourceEventIds: [],
            relatedEntityIds: [],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(indexMemory.id);
        }

        return { memoriesCreated, phase: 'complete' };
      } catch (err) {
        return {
          errors: [
            `Failed to create memories: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const shouldContinue = (state: SlackOnboardingState): string => {
      if (state.phase === 'error' || state.errors.length > 5) return END;
      if (state.phase === 'complete') return END;
      return 'continue';
    };

    const workflow = new StateGraph(SlackOnboardingStateAnnotation)
      .addNode('fetchChannels', fetchChannels)
      .addNode('fetchMembers', fetchMembers)
      .addNode('fetchMessages', fetchMessages)
      .addNode('analyze', analyze)
      .addNode('llmAnalysis', llmAnalysis)
      .addNode('createMemories', createMemories)
      .addEdge(START, 'fetchChannels')
      .addEdge('fetchChannels', 'fetchMembers')
      .addEdge('fetchMembers', 'fetchMessages')
      .addEdge('fetchMessages', 'analyze')
      .addEdge('analyze', 'llmAnalysis')
      .addConditionalEdges('llmAnalysis', shouldContinue, {
        continue: 'createMemories',
        [END]: END,
      })
      .addEdge('createMemories', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

}
