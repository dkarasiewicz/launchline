import { Inject, Injectable, Logger } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  LINEA_CHECKPOINTER,
  LINEA_STORE,
  LINEA_MODEL,
  LINEA_MODEL_FAST,
  LINEA_MODEL_ANALYSIS,
} from '../tokens';
import { MemoryService } from './memory.service';
import {
  LLMObservationsSchema,
  type GraphContext,
  type LinkedIdentity,
  type MemoryNamespace,
  type LLMObservation,
} from '../types';

const LinearOnboardingStateAnnotation = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  correlationId: Annotation<string>(),
  linearApiKey: Annotation<string>(),
  linearTeamId: Annotation<string>(),
  team: Annotation<LinearTeam | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  members: Annotation<LinearMember[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  projects: Annotation<LinearProject[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  milestones: Annotation<LinearMilestone[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  recentTickets: Annotation<LinearTicket[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  ticketPatterns: Annotation<TicketPattern[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  teamInsights: Annotation<TeamInsight[]>({
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

const GitHubOnboardingStateAnnotation = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  correlationId: Annotation<string>(),
  githubToken: Annotation<string>(),
  githubInstallationId: Annotation<string>(),
  repositories: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  repoInfos: Annotation<GitHubRepo[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  contributors: Annotation<GitHubContributor[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  openPRs: Annotation<GitHubPR[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  recentPRs: Annotation<GitHubPR[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  codingPatterns: Annotation<CodingPattern[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  teamPatterns: Annotation<GitHubTeamPattern[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  prInsights: Annotation<PRInsight[]>({
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

const IdentityLinkingStateAnnotation = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  correlationId: Annotation<string>(),
  githubAccounts: Annotation<GitHubAccount[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  linearAccounts: Annotation<LinearAccount[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  slackAccounts: Annotation<SlackAccount[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  linkedIdentities: Annotation<LinkedIdentity[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  unmatchedAccounts: Annotation<UnmatchedAccount[]>({
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
  phase: Annotation<LinkingPhase>({
    reducer: (_, next) => next,
    default: () => 'collecting',
  }),
});

type LinearOnboardingState = typeof LinearOnboardingStateAnnotation.State;
type GitHubOnboardingState = typeof GitHubOnboardingStateAnnotation.State;
type SlackOnboardingState = typeof SlackOnboardingStateAnnotation.State;
type IdentityLinkingState = typeof IdentityLinkingStateAnnotation.State;

type OnboardingPhase =
  | 'fetching'
  | 'analyzing'
  | 'llm_analysis'
  | 'creating_memories'
  | 'complete'
  | 'error';

type LinkingPhase =
  | 'collecting'
  | 'email_matching'
  | 'name_matching'
  | 'llm_inference'
  | 'saving'
  | 'complete'
  | 'error';

interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
}

interface LinearMember {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  active: boolean;
}

interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  progress: number;
  targetDate?: string;
}

interface LinearMilestone {
  id: string;
  name: string;
  targetDate?: string;
}

interface LinearTicket {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  state: { name: string; type: string };
  assignee?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

interface TicketPattern {
  type:
    | 'label_usage'
    | 'priority_distribution'
    | 'cycle_time'
    | 'blocker_frequency';
  description: string;
  data: Record<string, unknown>;
}

interface TeamInsight {
  type: 'workload' | 'expertise' | 'collaboration' | 'bottleneck';
  description: string;
  members?: string[];
  data: Record<string, unknown>;
}

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  language?: string;
  defaultBranch: string;
}

interface GitHubContributor {
  id: number;
  login: string;
  name?: string;
  contributions: number;
}

interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: string;
  author: { login: string };
  createdAt: string;
  mergedAt?: string;
}

interface CodingPattern {
  type: 'language' | 'framework' | 'convention' | 'review_style';
  description: string;
  data: Record<string, unknown>;
}

interface GitHubTeamPattern {
  type: 'reviewer' | 'contributor' | 'maintainer';
  description: string;
  members: string[];
  data: Record<string, unknown>;
}

interface PRInsight {
  type: 'review_time' | 'merge_patterns' | 'conflict_areas';
  description: string;
  data: Record<string, unknown>;
}

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

interface GitHubAccount {
  id: number;
  login: string;
  name?: string;
  email?: string;
}

interface LinearAccount {
  id: string;
  name: string;
  email?: string;
}

interface SlackAccount {
  id: string;
  name: string;
  realName: string;
  email?: string;
}

interface UnmatchedAccount {
  platform: 'github' | 'linear' | 'slack';
  account: GitHubAccount | LinearAccount | SlackAccount;
  reason: string;
}

@Injectable()
export class OnboardingGraphsFactory {
  private readonly logger = new Logger(OnboardingGraphsFactory.name);

  private linearOnboardingGraph: ReturnType<
    typeof this.createLinearOnboardingGraph
  > | null = null;
  private githubOnboardingGraph: ReturnType<
    typeof this.createGitHubOnboardingGraph
  > | null = null;
  private slackOnboardingGraph: ReturnType<
    typeof this.createSlackOnboardingGraph
  > | null = null;
  private identityLinkingGraph: ReturnType<
    typeof this.createIdentityLinkingGraph
  > | null = null;

  constructor(
    @Inject(LINEA_CHECKPOINTER)
    private readonly checkpointer: PostgresSaver,
    @Inject(LINEA_STORE)
    private readonly store: PostgresStore,
    @Inject(LINEA_MODEL)
    private readonly model: BaseChatModel,
    @Inject(LINEA_MODEL_FAST)
    private readonly modelFast: BaseChatModel,
    @Inject(LINEA_MODEL_ANALYSIS)
    private readonly modelAnalysis: BaseChatModel,
    private readonly memoryService: MemoryService,
  ) {}

  getLinearOnboardingGraph() {
    if (!this.linearOnboardingGraph) {
      this.linearOnboardingGraph = this.createLinearOnboardingGraph();
    }
    return this.linearOnboardingGraph;
  }

  getGitHubOnboardingGraph() {
    if (!this.githubOnboardingGraph) {
      this.githubOnboardingGraph = this.createGitHubOnboardingGraph();
    }
    return this.githubOnboardingGraph;
  }

  getSlackOnboardingGraph() {
    if (!this.slackOnboardingGraph) {
      this.slackOnboardingGraph = this.createSlackOnboardingGraph();
    }
    return this.slackOnboardingGraph;
  }

  getIdentityLinkingGraph() {
    if (!this.identityLinkingGraph) {
      this.identityLinkingGraph = this.createIdentityLinkingGraph();
    }
    return this.identityLinkingGraph;
  }

  async runLinearOnboarding(
    ctx: GraphContext,
    linearApiKey: string,
    linearTeamId: string,
  ): Promise<{ memoriesCreated: string[]; errors: string[] }> {
    this.logger.log(
      `Starting Linear onboarding for workspace ${ctx.workspaceId}`,
    );

    const graph = this.getLinearOnboardingGraph();
    const result = await graph.invoke({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      linearApiKey,
      linearTeamId,
    });

    return {
      memoriesCreated: result.memoriesCreated,
      errors: result.errors,
    };
  }

  async runGitHubOnboarding(
    ctx: GraphContext,
    githubToken: string,
    githubInstallationId: string,
    repositories?: string[],
  ): Promise<{ memoriesCreated: string[]; errors: string[] }> {
    this.logger.log(
      `Starting GitHub onboarding for workspace ${ctx.workspaceId}`,
    );

    const graph = this.getGitHubOnboardingGraph();
    const result = await graph.invoke({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      githubToken,
      githubInstallationId,
      repositories: repositories || [],
    });

    return {
      memoriesCreated: result.memoriesCreated,
      errors: result.errors,
    };
  }

  async runSlackOnboarding(
    ctx: GraphContext,
    slackToken: string,
    slackWorkspaceId: string,
  ): Promise<{ memoriesCreated: string[]; errors: string[] }> {
    this.logger.log(
      `Starting Slack onboarding for workspace ${ctx.workspaceId}`,
    );

    const graph = this.getSlackOnboardingGraph();
    const result = await graph.invoke({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      slackToken,
      slackWorkspaceId,
    });

    return {
      memoriesCreated: result.memoriesCreated,
      errors: result.errors,
    };
  }

  async runIdentityLinking(
    ctx: GraphContext,
    accounts: {
      github?: GitHubAccount[];
      linear?: LinearAccount[];
      slack?: SlackAccount[];
    },
  ): Promise<{
    linkedIdentities: LinkedIdentity[];
    unmatchedAccounts: UnmatchedAccount[];
    memoriesCreated: string[];
    errors: string[];
  }> {
    this.logger.log(
      `Starting identity linking for workspace ${ctx.workspaceId}`,
    );

    const graph = this.getIdentityLinkingGraph();
    const result = await graph.invoke({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      githubAccounts: accounts.github || [],
      linearAccounts: accounts.linear || [],
      slackAccounts: accounts.slack || [],
    });

    return {
      linkedIdentities: result.linkedIdentities,
      unmatchedAccounts: result.unmatchedAccounts,
      memoriesCreated: result.memoriesCreated,
      errors: result.errors,
    };
  }

  private createLinearOnboardingGraph() {
    const memoryService = this.memoryService;
    const model = this.modelAnalysis;

    const fetchTeam = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      try {
        // TODO: Integrate with actual Linear SDK
        this.logger.debug(`Fetching Linear team: ${state.linearTeamId}`);

        return {
          team: {
            id: state.linearTeamId,
            name: 'Team',
            key: 'TEAM',
            description: 'Fetched from Linear',
          },
          members: [],
          phase: 'fetching',
        };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch team: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const fetchProjects = async (
      _state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      try {
        // TODO: Integrate with actual Linear SDK
        return { projects: [], milestones: [] };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch projects: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const fetchTickets = async (
      _state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      try {
        // TODO: Integrate with actual Linear SDK
        return { recentTickets: [], phase: 'analyzing' };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch tickets: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const analyze = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      const ticketPatterns: TicketPattern[] = [];
      const teamInsights: TeamInsight[] = [];

      // Analyze ticket patterns
      if (state.recentTickets.length > 0) {
        const priorityDist = state.recentTickets.reduce(
          (acc, t) => {
            acc[t.priority] = (acc[t.priority] || 0) + 1;
            return acc;
          },
          {} as Record<number, number>,
        );

        ticketPatterns.push({
          type: 'priority_distribution',
          description: 'Distribution of ticket priorities',
          data: { distribution: priorityDist },
        });
      }

      return { ticketPatterns, teamInsights, phase: 'llm_analysis' };
    };

    const llmAnalysis = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      try {
        if (!state.team || state.projects.length === 0) {
          return { llmObservations: [], phase: 'creating_memories' };
        }

        const structuredModel = model.withStructuredOutput(
          LLMObservationsSchema,
          { name: 'analyze_linear_workspace' },
        );

        const result = await structuredModel.invoke([
          new SystemMessage(
            `You are analyzing a software team's Linear workspace. Provide structured insights about:
1. Team dynamics - how the team works together
2. Workflow patterns - common processes and bottlenecks
3. Risks - potential issues or concerns
4. Recommendations - actionable improvements

Return multiple observations with appropriate types and importance scores.`,
          ),
          new HumanMessage(
            `Team: ${state.team.name}
Projects: ${state.projects.map((p) => `${p.name} (${p.state}, ${p.progress}% complete)`).join(', ')}
Recent tickets: ${state.recentTickets.length}
Members: ${state.members.length}`,
          ),
        ]);

        return {
          llmObservations: result.observations,
          phase: 'creating_memories',
        };
      } catch (err) {
        this.logger.warn(`LLM analysis failed for Linear onboarding: ${err}`);

        return {
          errors: [
            `LLM analysis failed: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const createMemories = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      const memoriesCreated: string[] = [];
      const ctx: GraphContext = {
        workspaceId: state.workspaceId,
        userId: state.userId,
        correlationId: state.correlationId,
      };

      try {
        if (state.team) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'team' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              team: state.team,
              members: state.members,
              projects: state.projects,
            }),
            summary: `Linear team: ${state.team.name}`,
            importance: 0.8,
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
            content: obs.observation,
            summary: obs.title,
            importance: obs.importance,
            confidence: 0.8,
            sourceEventIds: [],
            relatedEntityIds: obs.relatedEntities || [],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
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

    const shouldContinue = (state: LinearOnboardingState): string => {
      if (state.phase === 'error' || state.errors.length > 5) return END;
      if (state.phase === 'complete') return END;
      return 'continue';
    };

    const workflow = new StateGraph(LinearOnboardingStateAnnotation)
      .addNode('fetchTeam', fetchTeam)
      .addNode('fetchProjects', fetchProjects)
      .addNode('fetchTickets', fetchTickets)
      .addNode('analyze', analyze)
      .addNode('llmAnalysis', llmAnalysis)
      .addNode('createMemories', createMemories)
      .addEdge(START, 'fetchTeam')
      .addEdge('fetchTeam', 'fetchProjects')
      .addEdge('fetchProjects', 'fetchTickets')
      .addEdge('fetchTickets', 'analyze')
      .addEdge('analyze', 'llmAnalysis')
      .addConditionalEdges('llmAnalysis', shouldContinue, {
        continue: 'createMemories',
        [END]: END,
      })
      .addEdge('createMemories', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  private createGitHubOnboardingGraph() {
    const memoryService = this.memoryService;
    const model = this.modelAnalysis;

    const fetchRepos = async (
      state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      try {
        // TODO: Integrate with actual GitHub API
        this.logger.debug(
          `Fetching GitHub repos for installation: ${state.githubInstallationId}`,
        );
        return { repoInfos: [], phase: 'fetching' };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch repos: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const fetchContributors = async (
      _state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      try {
        // TODO: Integrate with actual GitHub API
        return { contributors: [] };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch contributors: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const fetchPRs = async (
      _state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      try {
        // TODO: Integrate with actual GitHub API
        return { openPRs: [], recentPRs: [], phase: 'analyzing' };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch PRs: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const analyze = async (
      state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      const codingPatterns: CodingPattern[] = [];
      const teamPatterns: GitHubTeamPattern[] = [];
      const prInsights: PRInsight[] = [];

      const languages = state.repoInfos.map((r) => r.language).filter(Boolean);

      if (languages.length > 0) {
        const langDist = languages.reduce(
          (acc, lang) => {
            if (!lang) {
              return acc;
            }

            acc[lang] = (acc[lang] || 0) + 1;

            return acc;
          },
          {} as Record<string, number>,
        );

        codingPatterns.push({
          type: 'language',
          description: 'Primary languages used',
          data: { distribution: langDist },
        });
      }

      return {
        codingPatterns,
        teamPatterns,
        prInsights,
        phase: 'llm_analysis',
      };
    };

    const llmAnalysis = async (
      state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      try {
        if (state.repoInfos.length === 0) {
          return { llmObservations: [], phase: 'creating_memories' };
        }

        const structuredModel = model.withStructuredOutput(
          LLMObservationsSchema,
          { name: 'analyze_github_workspace' },
        );

        const result = await structuredModel.invoke([
          new SystemMessage(
            `You are analyzing a software team's GitHub repositories. Provide structured insights about:
1. Coding patterns - languages, frameworks, conventions
2. Team dynamics - who works on what, collaboration patterns
3. Code quality risks - potential issues or concerns
4. Recommendations - actionable improvements

Return multiple observations with appropriate types and importance scores.`,
          ),
          new HumanMessage(
            `Repositories: ${state.repoInfos.map((r) => `${r.name} (${r.language || 'unknown'})`).join(', ')}
Contributors: ${state.contributors.length}
Open PRs: ${state.openPRs.length}
Recent PRs: ${state.recentPRs.length}`,
          ),
        ]);

        return {
          llmObservations: result.observations,
          phase: 'creating_memories',
        };
      } catch (err) {
        this.logger.warn(`LLM analysis failed for GitHub onboarding: ${err}`);
        return {
          errors: [
            `LLM analysis failed: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const createMemories = async (
      state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      const memoriesCreated: string[] = [];
      const ctx: GraphContext = {
        workspaceId: state.workspaceId,
        userId: state.userId,
        correlationId: state.correlationId,
      };

      try {
        if (state.repoInfos.length > 0) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'codebase' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              repos: state.repoInfos,
              contributors: state.contributors,
            }),
            summary: `GitHub repositories: ${state.repoInfos.map((r) => r.name).join(', ')}`,
            importance: 0.8,
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
            namespace: 'codebase' as MemoryNamespace,
            category: 'insight',
            content: obs.observation,
            summary: obs.title,
            importance: obs.importance,
            confidence: 0.8,
            sourceEventIds: [],
            relatedEntityIds: obs.relatedEntities || [],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
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

    const shouldContinue = (state: GitHubOnboardingState): string => {
      if (state.phase === 'error' || state.errors.length > 5) return END;
      if (state.phase === 'complete') return END;
      return 'continue';
    };

    const workflow = new StateGraph(GitHubOnboardingStateAnnotation)
      .addNode('fetchRepos', fetchRepos)
      .addNode('fetchContributors', fetchContributors)
      .addNode('fetchPRs', fetchPRs)
      .addNode('analyze', analyze)
      .addNode('llmAnalysis', llmAnalysis)
      .addNode('createMemories', createMemories)
      .addEdge(START, 'fetchRepos')
      .addEdge('fetchRepos', 'fetchContributors')
      .addEdge('fetchContributors', 'fetchPRs')
      .addEdge('fetchPRs', 'analyze')
      .addEdge('analyze', 'llmAnalysis')
      .addConditionalEdges('llmAnalysis', shouldContinue, {
        continue: 'createMemories',
        [END]: END,
      })
      .addEdge('createMemories', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  private createSlackOnboardingGraph() {
    const memoryService = this.memoryService;
    const model = this.modelAnalysis;

    const fetchChannels = async (
      state: SlackOnboardingState,
    ): Promise<Partial<SlackOnboardingState>> => {
      try {
        // TODO: Integrate with actual Slack API
        this.logger.debug(
          `Fetching Slack channels for workspace: ${state.slackWorkspaceId}`,
        );
        return { channels: [], phase: 'fetching' };
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
        // TODO: Integrate with actual Slack API
        return { members: [] };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch members: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const fetchMessages = async (
      _state: SlackOnboardingState,
    ): Promise<Partial<SlackOnboardingState>> => {
      try {
        // TODO: Integrate with actual Slack API
        return { recentMessages: new Map(), phase: 'analyzing' };
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
        this.logger.warn(`LLM analysis failed for Slack onboarding: ${err}`);
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
        if (state.channels.length > 0) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'team' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              channels: state.channels,
              members: state.members,
            }),
            summary: `Slack workspace: ${state.channels.length} channels`,
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
            content: obs.observation,
            summary: obs.title,
            importance: obs.importance,
            confidence: 0.8,
            sourceEventIds: [],
            relatedEntityIds: obs.relatedEntities || [],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
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

  private createIdentityLinkingGraph() {
    const memoryService = this.memoryService;

    const matchByEmail = async (
      state: IdentityLinkingState,
    ): Promise<Partial<IdentityLinkingState>> => {
      const linkedIdentities: LinkedIdentity[] = [];
      const usedGitHub = new Set<number>();
      const usedLinear = new Set<string>();
      const usedSlack = new Set<string>();

      for (const gh of state.githubAccounts) {
        const email = gh.email;

        if (!email || usedGitHub.has(gh.id)) {
          continue;
        }

        const linearMatch = state.linearAccounts.find(
          (l) =>
            l.email &&
            l.email.toLowerCase() === email.toLowerCase() &&
            !usedLinear.has(l.id),
        );
        const slackMatch = state.slackAccounts.find(
          (s) =>
            s.email &&
            s.email.toLowerCase() === email.toLowerCase() &&
            !usedSlack.has(s.id),
        );

        if (linearMatch || slackMatch) {
          linkedIdentities.push({
            id: `identity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            workspaceId: state.workspaceId,
            displayName: gh.name || gh.login,
            email,
            accounts: {
              github: { id: gh.id, login: gh.login, name: gh.name },
              linear: linearMatch
                ? { id: linearMatch.id, name: linearMatch.name }
                : undefined,
              slack: slackMatch
                ? {
                    id: slackMatch.id,
                    name: slackMatch.name,
                    realName: slackMatch.realName,
                  }
                : undefined,
            },
            linkingMethod: 'email',
            confidence: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          usedGitHub.add(gh.id);
          if (linearMatch) usedLinear.add(linearMatch.id);
          if (slackMatch) usedSlack.add(slackMatch.id);
        }
      }

      return { linkedIdentities, phase: 'name_matching' };
    };

    const matchByName = async (
      state: IdentityLinkingState,
    ): Promise<Partial<IdentityLinkingState>> => {
      const linkedIdentities = [...state.linkedIdentities];
      const usedGitHub = new Set(
        linkedIdentities
          .map((l) => l.accounts.github?.id)
          .filter(Boolean) as number[],
      );
      const usedLinear = new Set(
        linkedIdentities
          .map((l) => l.accounts.linear?.id)
          .filter(Boolean) as string[],
      );
      const usedSlack = new Set(
        linkedIdentities
          .map((l) => l.accounts.slack?.id)
          .filter(Boolean) as string[],
      );

      for (const gh of state.githubAccounts) {
        const name = gh.name;

        if (usedGitHub.has(gh.id) || !name) continue;

        const linearMatch = state.linearAccounts.find(
          (l) =>
            !usedLinear.has(l.id) && this.nameSimilarity(name, l.name) > 0.7,
        );
        const slackMatch = state.slackAccounts.find(
          (s) =>
            !usedSlack.has(s.id) && this.nameSimilarity(name, s.realName) > 0.7,
        );

        if (linearMatch || slackMatch) {
          linkedIdentities.push({
            id: `identity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            workspaceId: state.workspaceId,
            displayName: name || gh.login,
            email: gh.email,
            accounts: {
              github: { id: gh.id, login: gh.login, name: gh.name },
              linear: linearMatch
                ? { id: linearMatch.id, name: linearMatch.name }
                : undefined,
              slack: slackMatch
                ? {
                    id: slackMatch.id,
                    name: slackMatch.name,
                    realName: slackMatch.realName,
                  }
                : undefined,
            },
            linkingMethod: 'name_match',
            confidence: 0.8,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          usedGitHub.add(gh.id);
          if (linearMatch) usedLinear.add(linearMatch.id);
          if (slackMatch) usedSlack.add(slackMatch.id);
        }
      }

      return { linkedIdentities, phase: 'saving' };
    };

    const saveIdentities = async (
      state: IdentityLinkingState,
    ): Promise<Partial<IdentityLinkingState>> => {
      const memoriesCreated: string[] = [];
      const unmatchedAccounts: UnmatchedAccount[] = [];
      const ctx: GraphContext = {
        workspaceId: state.workspaceId,
        userId: state.userId,
        correlationId: state.correlationId,
      };

      try {
        for (const identity of state.linkedIdentities) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'team' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify(identity),
            summary: `Identity: ${identity.displayName}`,
            importance: 0.9,
            confidence: identity.confidence,
            sourceEventIds: [],
            relatedEntityIds: [identity.id],
            relatedMemoryIds: [],
            entityRefs: {
              userIds: [identity.id],
            },
          });
          memoriesCreated.push(memory.id);
        }

        const usedGitHub = new Set(
          state.linkedIdentities
            .map((l) => l.accounts.github?.id)
            .filter(Boolean),
        );
        const usedLinear = new Set(
          state.linkedIdentities
            .map((l) => l.accounts.linear?.id)
            .filter(Boolean),
        );
        const usedSlack = new Set(
          state.linkedIdentities
            .map((l) => l.accounts.slack?.id)
            .filter(Boolean),
        );

        for (const gh of state.githubAccounts) {
          if (!usedGitHub.has(gh.id)) {
            unmatchedAccounts.push({
              platform: 'github',
              account: gh,
              reason: 'No matching accounts found',
            });
          }
        }

        for (const l of state.linearAccounts) {
          if (!usedLinear.has(l.id)) {
            unmatchedAccounts.push({
              platform: 'linear',
              account: l,
              reason: 'No matching accounts found',
            });
          }
        }

        for (const s of state.slackAccounts) {
          if (!usedSlack.has(s.id)) {
            unmatchedAccounts.push({
              platform: 'slack',
              account: s,
              reason: 'No matching accounts found',
            });
          }
        }

        return { memoriesCreated, unmatchedAccounts, phase: 'complete' };
      } catch (err) {
        return {
          errors: [
            `Failed to save identities: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const shouldContinue = (state: IdentityLinkingState): string => {
      if (state.phase === 'error' || state.errors.length > 5) return END;
      if (state.phase === 'complete') return END;
      return 'continue';
    };

    const workflow = new StateGraph(IdentityLinkingStateAnnotation)
      .addNode('matchByEmail', matchByEmail)
      .addNode('matchByName', matchByName)
      .addNode('saveIdentities', saveIdentities)
      .addEdge(START, 'matchByEmail')
      .addEdge('matchByEmail', 'matchByName')
      .addConditionalEdges('matchByName', shouldContinue, {
        continue: 'saveIdentities',
        [END]: END,
      })
      .addEdge('saveIdentities', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  private normalizeName(name: string | undefined): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private nameSimilarity(a: string, b: string): number {
    const normA = this.normalizeName(a);
    const normB = this.normalizeName(b);

    if (normA === normB) return 1;
    if (!normA || !normB) return 0;

    if (normA.includes(normB) || normB.includes(normA)) {
      return 0.8;
    }

    const partsA = a.toLowerCase().split(/\s+/);
    const partsB = b.toLowerCase().split(/\s+/);

    for (const partA of partsA) {
      for (const partB of partsB) {
        if (partA.length > 2 && partB.length > 2 && partA === partB) {
          return 0.7;
        }
      }
    }

    return 0;
  }
}
