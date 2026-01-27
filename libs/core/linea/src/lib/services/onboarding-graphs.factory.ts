import { Inject, Injectable, Logger } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { LinearClient } from '@linear/sdk';
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
  type InboxItemCandidate,
} from '../types';

const LinearOnboardingStateAnnotation = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  correlationId: Annotation<string>(),
  accessToken: Annotation<string>(),
  linearTeamId: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  organization: Annotation<LinearOrganization | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  teams: Annotation<LinearTeam[]>({
    reducer: (_, next) => next,
    default: () => [],
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
  cycles: Annotation<LinearCycle[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  recentTickets: Annotation<LinearTicket[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  labels: Annotation<LinearLabel[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  workflowStates: Annotation<LinearWorkflowState[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  // Grouped data structures
  ticketsByProject: Annotation<Map<string, ProjectTicketGroup>>({
    reducer: (_, next) => next,
    default: () => new Map(),
  }),
  ticketsByMilestone: Annotation<Map<string, MilestoneTicketGroup>>({
    reducer: (_, next) => next,
    default: () => new Map(),
  }),
  ticketsByUser: Annotation<Map<string, UserTicketGroup>>({
    reducer: (_, next) => next,
    default: () => new Map(),
  }),
  // Project analysis from LLM
  projectAnalyses: Annotation<ProjectAnalysis[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  // Inbox candidates
  inboxCandidates: Annotation<InboxItemCandidate[]>({
    reducer: (prev, next) => [...prev, ...next],
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
  | 'detect_inbox'
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

interface LinearOrganization {
  id: string;
  name: string;
  urlKey: string;
  logoUrl?: string;
  createdAt: string;
}

interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
  color?: string;
  icon?: string;
  private: boolean;
}

interface LinearMember {
  id: string;
  name: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  isAdmin: boolean;
  active: boolean;
  createdAt: string;
}

interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  progress: number;
  targetDate?: string;
  startDate?: string;
  lead?: { id: string; name: string };
  teamIds: string[];
}

interface LinearMilestone {
  id: string;
  name: string;
  description?: string;
  targetDate?: string;
  sortOrder: number;
}

interface LinearCycle {
  id: string;
  name?: string;
  number: number;
  startsAt: string;
  endsAt: string;
  completedAt?: string;
  progress: number;
  scopePercentage: number;
  teamId: string;
}

interface LinearLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
  teamId?: string;
}

interface LinearWorkflowState {
  id: string;
  name: string;
  type: string;
  color: string;
  position: number;
  teamId: string;
}

interface LinearTicket {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  estimate?: number;
  state: { id: string; name: string; type: string };
  assignee?: { id: string; name: string };
  labels: { id: string; name: string }[];
  project?: { id: string; name: string };
  cycle?: { id: string; number: number };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
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

// Grouped data structures for Linear onboarding
interface ProjectTicketGroup {
  project: LinearProject;
  tickets: LinearTicket[];
  ticketsByState: Record<string, LinearTicket[]>;
  ticketsByPriority: Record<string, LinearTicket[]>;
  ticketsByAssignee: Record<string, LinearTicket[]>;
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
    avgPriority: number;
  };
}

interface MilestoneTicketGroup {
  milestone: LinearMilestone;
  tickets: LinearTicket[];
  ticketsByProject: Record<string, LinearTicket[]>;
  stats: {
    total: number;
    completed: number;
    onTrack: boolean;
  };
}

interface UserTicketGroup {
  user: { id: string; name: string; email?: string };
  tickets: LinearTicket[];
  ticketsByProject: Record<string, LinearTicket[]>;
  ticketsByState: Record<string, LinearTicket[]>;
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    highPriority: number;
  };
}

interface ProjectAnalysis {
  projectId: string;
  projectName: string;
  summary: string;
  purpose: string;
  currentState: string;
  keyFeatures: string[];
  risks: string[];
  blockers: string[];
  recommendations: string[];
  healthScore: number; // 0-100
  teamMembers: string[];
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
    accessToken: string,
    linearTeamId?: string,
  ): Promise<{
    memoriesCreated: string[];
    inboxCandidates: InboxItemCandidate[];
    errors: string[];
  }> {
    this.logger.log(
      `Starting Linear onboarding for workspace ${ctx.workspaceId}`,
    );

    const graph = this.getLinearOnboardingGraph();
    const result = await graph.invoke({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      accessToken,
      linearTeamId: linearTeamId || null,
    });

    return {
      memoriesCreated: result.memoriesCreated,
      inboxCandidates: result.inboxCandidates,
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
    const logger = this.logger;

    // Helper to create Linear client from state
    const getLinearClient = (state: LinearOnboardingState): LinearClient => {
      return new LinearClient({ accessToken: state.accessToken });
    };

    const fetchOrganizationAndTeams = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      try {
        const client = getLinearClient(state);
        logger.debug('Fetching Linear organization and teams');

        // Fetch organization info
        const organization = await client.organization;
        const orgData: LinearOrganization = {
          id: organization.id,
          name: organization.name,
          urlKey: organization.urlKey,
          logoUrl: organization.logoUrl ?? undefined,
          createdAt: organization.createdAt.toISOString(),
        };

        // Fetch teams
        const teamsResponse = await client.teams();
        const teams: LinearTeam[] = teamsResponse.nodes.map((team) => ({
          id: team.id,
          name: team.name,
          key: team.key,
          description: team.description ?? undefined,
          color: team.color ?? undefined,
          icon: team.icon ?? undefined,
          private: team.private,
        }));

        // If a specific team is requested, filter to that team
        const filteredTeams = state.linearTeamId
          ? teams.filter((t) => t.id === state.linearTeamId)
          : teams;

        logger.debug(
          `Fetched organization: ${orgData.name}, teams: ${filteredTeams.length}`,
        );

        return {
          organization: orgData,
          teams: filteredTeams,
          phase: 'fetching',
        };
      } catch (err) {
        logger.error(`Failed to fetch organization/teams: ${err}`);
        return {
          errors: [
            `Failed to fetch organization/teams: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const fetchMembers = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      try {
        const client = getLinearClient(state);
        logger.debug('Fetching Linear members');

        const usersResponse = await client.users();
        const members: LinearMember[] = usersResponse.nodes.map((user) => ({
          id: user.id,
          name: user.name,
          displayName: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl ?? undefined,
          isAdmin: user.admin,
          active: user.active,
          createdAt: user.createdAt.toISOString(),
        }));

        logger.debug(`Fetched ${members.length} members`);

        return { members };
      } catch (err) {
        logger.error(`Failed to fetch members: ${err}`);
        return {
          errors: [
            `Failed to fetch members: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const fetchProjects = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      try {
        const client = getLinearClient(state);
        logger.debug('Fetching Linear projects and milestones');

        // Fetch projects
        const projectsResponse = await client.projects({
          first: 50,
          orderBy: { updatedAt: 'DESC' } as any,
        });

        const projects: LinearProject[] = await Promise.all(
          projectsResponse.nodes.map(async (project) => {
            const lead = await project.lead;
            const teams = await project.teams();
            return {
              id: project.id,
              name: project.name,
              description: project.description ?? undefined,
              state: project.state,
              progress: project.progress,
              targetDate: project.targetDate
                ? new Date(project.targetDate).toISOString()
                : undefined,
              startDate: project.startedAt
                ? project.startedAt.toISOString()
                : undefined,
              lead: lead ? { id: lead.id, name: lead.name } : undefined,
              teamIds: teams.nodes.map((t) => t.id),
            };
          }),
        );

        // Fetch milestones (roadmap milestones)
        const milestonesResponse = await client.projectMilestones({
          first: 50,
        });
        const milestones: LinearMilestone[] = milestonesResponse.nodes.map(
          (milestone) => ({
            id: milestone.id,
            name: milestone.name,
            description: milestone.description ?? undefined,
            targetDate: milestone.targetDate
              ? new Date(milestone.targetDate).toISOString()
              : undefined,
            sortOrder: milestone.sortOrder,
          }),
        );

        logger.debug(
          `Fetched ${projects.length} projects, ${milestones.length} milestones`,
        );

        return { projects, milestones };
      } catch (err) {
        logger.error(`Failed to fetch projects: ${err}`);
        return {
          errors: [
            `Failed to fetch projects: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const fetchCyclesAndLabels = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      try {
        const client = getLinearClient(state);
        logger.debug('Fetching Linear cycles, labels, and workflow states');

        // Fetch cycles for all teams
        const allCycles: LinearCycle[] = [];
        for (const team of state.teams) {
          const teamObj = await client.team(team.id);
          const cyclesResponse = await teamObj.cycles({ first: 10 });
          for (const cycle of cyclesResponse.nodes) {
            allCycles.push({
              id: cycle.id,
              name: cycle.name ?? undefined,
              number: cycle.number,
              startsAt: cycle.startsAt.toISOString(),
              endsAt: cycle.endsAt.toISOString(),
              completedAt: cycle.completedAt?.toISOString(),
              progress: cycle.progress,
              scopePercentage: cycle.completedScopeHistory?.length
                ? (cycle.completedScopeHistory[
                    cycle.completedScopeHistory.length - 1
                  ] ?? 0)
                : 0,
              teamId: team.id,
            });
          }
        }

        // Fetch labels
        const labelsResponse = await client.issueLabels({ first: 100 });
        const labels: LinearLabel[] = await Promise.all(
          labelsResponse.nodes.map(async (label) => {
            const team = await label.team;
            return {
              id: label.id,
              name: label.name,
              color: label.color,
              description: label.description ?? undefined,
              teamId: team?.id,
            };
          }),
        );

        // Fetch workflow states for all teams
        const allWorkflowStates: LinearWorkflowState[] = [];
        for (const team of state.teams) {
          const teamObj = await client.team(team.id);
          const statesResponse = await teamObj.states();
          for (const wfState of statesResponse.nodes) {
            allWorkflowStates.push({
              id: wfState.id,
              name: wfState.name,
              type: wfState.type,
              color: wfState.color,
              position: wfState.position,
              teamId: team.id,
            });
          }
        }

        logger.debug(
          `Fetched ${allCycles.length} cycles, ${labels.length} labels, ${allWorkflowStates.length} workflow states`,
        );

        return {
          cycles: allCycles,
          labels,
          workflowStates: allWorkflowStates,
        };
      } catch (err) {
        logger.error(`Failed to fetch cycles/labels: ${err}`);
        return {
          errors: [
            `Failed to fetch cycles/labels: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const fetchTickets = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      try {
        const client = getLinearClient(state);
        logger.debug('Fetching all Linear issues with pagination');

        const allTickets: LinearTicket[] = [];
        let hasNextPage = true;
        let endCursor: string | undefined = undefined;
        const pageSize = 100;
        const maxPages = 50; // Safety limit: max 5000 tickets
        let pageCount = 0;

        while (hasNextPage && pageCount < maxPages) {
          pageCount++;
          logger.debug(`Fetching issues page ${pageCount}...`);

          const issuesResponse = await client.issues({
            first: pageSize,
            after: endCursor,
            orderBy: { updatedAt: 'DESC' } as any,
            filter: state.linearTeamId
              ? { team: { id: { eq: state.linearTeamId } } }
              : undefined,
          });

          // Process issues in parallel batches to avoid rate limiting
          const batchSize = 20;
          const nodes = issuesResponse.nodes;

          for (let i = 0; i < nodes.length; i += batchSize) {
            const batch = nodes.slice(i, i + batchSize);
            const batchTickets = await Promise.all(
              batch.map(async (issue) => {
                const issueState = await issue.state;
                const assignee = await issue.assignee;
                const labelsConn = await issue.labels();
                const project = await issue.project;
                const cycle = await issue.cycle;

                return {
                  id: issue.id,
                  identifier: issue.identifier,
                  title: issue.title,
                  description: issue.description ?? undefined,
                  priority: issue.priority,
                  priorityLabel: issue.priorityLabel,
                  estimate: issue.estimate ?? undefined,
                  state: issueState
                    ? {
                        id: issueState.id,
                        name: issueState.name,
                        type: issueState.type,
                      }
                    : { id: '', name: 'Unknown', type: 'unstarted' },
                  assignee: assignee
                    ? { id: assignee.id, name: assignee.name }
                    : undefined,
                  labels: labelsConn.nodes.map((l) => ({
                    id: l.id,
                    name: l.name,
                  })),
                  project: project
                    ? { id: project.id, name: project.name }
                    : undefined,
                  cycle: cycle
                    ? { id: cycle.id, number: cycle.number }
                    : undefined,
                  createdAt: issue.createdAt.toISOString(),
                  updatedAt: issue.updatedAt.toISOString(),
                  completedAt: issue.completedAt?.toISOString(),
                };
              }),
            );
            allTickets.push(...batchTickets);
          }

          // Check for next page
          hasNextPage = issuesResponse.pageInfo.hasNextPage;
          endCursor = issuesResponse.pageInfo.endCursor ?? undefined;

          logger.debug(
            `Page ${pageCount}: fetched ${nodes.length} issues, total: ${allTickets.length}, hasNextPage: ${hasNextPage}`,
          );
        }

        if (pageCount >= maxPages) {
          logger.warn(
            `Reached max page limit (${maxPages}), stopping pagination with ${allTickets.length} issues`,
          );
        }

        logger.debug(`Fetched total of ${allTickets.length} issues`);

        return { recentTickets: allTickets, phase: 'analyzing' };
      } catch (err) {
        logger.error(`Failed to fetch issues: ${err}`);
        return {
          errors: [
            `Failed to fetch issues: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const groupTickets = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      logger.debug('Grouping tickets by project, milestone, and user');

      // Group by project
      const ticketsByProject = new Map<string, ProjectTicketGroup>();
      const noProjectTickets: LinearTicket[] = [];

      for (const ticket of state.recentTickets) {
        if (ticket.project) {
          const projectId = ticket.project.id;
          if (!ticketsByProject.has(projectId)) {
            const project = state.projects.find((p) => p.id === projectId);
            if (project) {
              ticketsByProject.set(projectId, {
                project,
                tickets: [],
                ticketsByState: {},
                ticketsByPriority: {},
                ticketsByAssignee: {},
                stats: {
                  total: 0,
                  completed: 0,
                  inProgress: 0,
                  blocked: 0,
                  avgPriority: 0,
                },
              });
            }
          }
          const group = ticketsByProject.get(projectId);
          if (group) {
            group.tickets.push(ticket);
            // Group by state
            const stateName = ticket.state.name;
            if (!group.ticketsByState[stateName])
              group.ticketsByState[stateName] = [];
            group.ticketsByState[stateName].push(ticket);
            // Group by priority
            const priorityLabel = ticket.priorityLabel || `P${ticket.priority}`;
            if (!group.ticketsByPriority[priorityLabel])
              group.ticketsByPriority[priorityLabel] = [];
            group.ticketsByPriority[priorityLabel].push(ticket);
            // Group by assignee
            if (ticket.assignee) {
              const assigneeName = ticket.assignee.name;
              if (!group.ticketsByAssignee[assigneeName])
                group.ticketsByAssignee[assigneeName] = [];
              group.ticketsByAssignee[assigneeName].push(ticket);
            }
          }
        } else {
          noProjectTickets.push(ticket);
        }
      }

      // Calculate stats for each project
      for (const group of ticketsByProject.values()) {
        group.stats.total = group.tickets.length;
        group.stats.completed = group.tickets.filter(
          (t) => t.state.type === 'completed',
        ).length;
        group.stats.inProgress = group.tickets.filter(
          (t) => t.state.type === 'started',
        ).length;
        group.stats.blocked = group.tickets.filter((t) =>
          t.labels.some((l) => l.name.toLowerCase().includes('block')),
        ).length;
        group.stats.avgPriority =
          group.tickets.reduce((sum, t) => sum + t.priority, 0) /
            group.tickets.length || 0;
      }

      // Group by milestone (using cycle as proxy for milestone/sprint)
      const ticketsByMilestone = new Map<string, MilestoneTicketGroup>();
      for (const ticket of state.recentTickets) {
        if (ticket.cycle) {
          const cycleId = ticket.cycle.id;
          if (!ticketsByMilestone.has(cycleId)) {
            const cycle = state.cycles.find((c) => c.id === cycleId);
            if (cycle) {
              ticketsByMilestone.set(cycleId, {
                milestone: {
                  id: cycle.id,
                  name: cycle.name || `Sprint ${cycle.number}`,
                  description: undefined,
                  targetDate: cycle.endsAt,
                  sortOrder: cycle.number,
                },
                tickets: [],
                ticketsByProject: {},
                stats: { total: 0, completed: 0, onTrack: true },
              });
            }
          }
          const group = ticketsByMilestone.get(cycleId);
          if (group) {
            group.tickets.push(ticket);
            if (ticket.project) {
              const projectName = ticket.project.name;
              if (!group.ticketsByProject[projectName])
                group.ticketsByProject[projectName] = [];
              group.ticketsByProject[projectName].push(ticket);
            }
          }
        }
      }

      // Calculate milestone stats
      for (const group of ticketsByMilestone.values()) {
        group.stats.total = group.tickets.length;
        group.stats.completed = group.tickets.filter(
          (t) => t.state.type === 'completed',
        ).length;
        const cycle = state.cycles.find((c) => c.id === group.milestone.id);
        if (cycle) {
          const completionRate =
            group.stats.total > 0
              ? group.stats.completed / group.stats.total
              : 0;
          const timeElapsed = cycle.progress;
          group.stats.onTrack = completionRate >= timeElapsed * 0.8; // 80% buffer
        }
      }

      // Group by user
      const ticketsByUser = new Map<string, UserTicketGroup>();
      for (const ticket of state.recentTickets) {
        if (ticket.assignee) {
          const userId = ticket.assignee.id;
          if (!ticketsByUser.has(userId)) {
            const member = state.members.find((m) => m.id === userId);
            ticketsByUser.set(userId, {
              user: {
                id: userId,
                name: ticket.assignee.name,
                email: member?.email,
              },
              tickets: [],
              ticketsByProject: {},
              ticketsByState: {},
              stats: { total: 0, completed: 0, inProgress: 0, highPriority: 0 },
            });
          }
          const group = ticketsByUser.get(userId);
          if (group) {
            group.tickets.push(ticket);
            // Group by project
            if (ticket.project) {
              const projectName = ticket.project.name;
              if (!group.ticketsByProject[projectName])
                group.ticketsByProject[projectName] = [];
              group.ticketsByProject[projectName].push(ticket);
            }
            // Group by state
            const stateName = ticket.state.name;
            if (!group.ticketsByState[stateName])
              group.ticketsByState[stateName] = [];
            group.ticketsByState[stateName].push(ticket);
          }
        }
      }

      // Calculate user stats
      for (const group of ticketsByUser.values()) {
        group.stats.total = group.tickets.length;
        group.stats.completed = group.tickets.filter(
          (t) => t.state.type === 'completed',
        ).length;
        group.stats.inProgress = group.tickets.filter(
          (t) => t.state.type === 'started',
        ).length;
        group.stats.highPriority = group.tickets.filter(
          (t) => t.priority <= 2,
        ).length;
      }

      logger.debug(
        `Grouped tickets: ${ticketsByProject.size} projects, ${ticketsByMilestone.size} milestones, ${ticketsByUser.size} users`,
      );

      return { ticketsByProject, ticketsByMilestone, ticketsByUser };
    };

    const analyze = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      const ticketPatterns: TicketPattern[] = [];
      const teamInsights: TeamInsight[] = [];

      // Analyze priority distribution
      if (state.recentTickets.length > 0) {
        const priorityDist = state.recentTickets.reduce(
          (acc, t) => {
            const label = t.priorityLabel || `P${t.priority}`;
            acc[label] = (acc[label] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        ticketPatterns.push({
          type: 'priority_distribution',
          description: 'Distribution of ticket priorities',
          data: {
            distribution: priorityDist,
            total: state.recentTickets.length,
          },
        });

        // Analyze label usage
        const labelUsage: Record<string, number> = {};
        for (const ticket of state.recentTickets) {
          for (const label of ticket.labels) {
            labelUsage[label.name] = (labelUsage[label.name] || 0) + 1;
          }
        }

        if (Object.keys(labelUsage).length > 0) {
          ticketPatterns.push({
            type: 'label_usage',
            description: 'Most commonly used labels',
            data: {
              labels: Object.entries(labelUsage)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10),
            },
          });
        }

        // Analyze state distribution
        const stateDist = state.recentTickets.reduce(
          (acc, t) => {
            acc[t.state.name] = (acc[t.state.name] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        ticketPatterns.push({
          type: 'cycle_time',
          description: 'Distribution of ticket states',
          data: { states: stateDist },
        });

        // Detect potential blockers
        const blockerTickets = state.recentTickets.filter(
          (t) =>
            t.labels.some((l) => l.name.toLowerCase().includes('block')) ||
            t.priority === 1,
        );
        if (blockerTickets.length > 0) {
          ticketPatterns.push({
            type: 'blocker_frequency',
            description: 'Tickets marked as blockers or urgent',
            data: {
              count: blockerTickets.length,
              tickets: blockerTickets.map((t) => ({
                id: t.identifier,
                title: t.title,
                assignee: t.assignee?.name,
              })),
            },
          });
        }
      }

      // Analyze team workload from grouped data
      if (state.ticketsByUser.size > 0) {
        const workloadData: Record<
          string,
          { total: number; inProgress: number; highPriority: number }
        > = {};
        for (const [, group] of state.ticketsByUser) {
          workloadData[group.user.name] = {
            total: group.stats.total,
            inProgress: group.stats.inProgress,
            highPriority: group.stats.highPriority,
          };
        }

        const topAssignees = Object.entries(workloadData)
          .sort(([, a], [, b]) => b.total - a.total)
          .slice(0, 10);

        teamInsights.push({
          type: 'workload',
          description: 'Team workload distribution',
          members: topAssignees.map(([name]) => name),
          data: { workload: Object.fromEntries(topAssignees) },
        });
      }

      // Analyze project health from grouped data
      if (state.ticketsByProject.size > 0) {
        const projectHealth: Record<
          string,
          { progress: number; blocked: number; total: number }
        > = {};
        for (const [, group] of state.ticketsByProject) {
          const completionRate =
            group.stats.total > 0
              ? (group.stats.completed / group.stats.total) * 100
              : 0;
          projectHealth[group.project.name] = {
            progress: Math.round(completionRate),
            blocked: group.stats.blocked,
            total: group.stats.total,
          };
        }

        teamInsights.push({
          type: 'bottleneck',
          description: 'Project health overview',
          data: { projectHealth },
        });
      }

      return { ticketPatterns, teamInsights, phase: 'llm_analysis' };
    };

    const analyzeProjects = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      const projectAnalyses: ProjectAnalysis[] = [];

      if (state.ticketsByProject.size === 0) {
        return { projectAnalyses, phase: 'llm_analysis' };
      }

      logger.debug(
        `Analyzing ${state.ticketsByProject.size} projects with LLM`,
      );

      // Analyze each project with LLM
      for (const [projectId, group] of state.ticketsByProject) {
        try {
          // Build project context
          const ticketSummary = group.tickets.slice(0, 50).map((t) => ({
            id: t.identifier,
            title: t.title,
            state: t.state.name,
            priority: t.priorityLabel,
            assignee: t.assignee?.name,
            labels: t.labels.map((l) => l.name),
          }));

          const stateDistribution = Object.entries(group.ticketsByState)
            .map(([state, tickets]) => `${state}: ${tickets.length}`)
            .join(', ');

          const assigneeDistribution = Object.entries(group.ticketsByAssignee)
            .map(([name, tickets]) => `${name}: ${tickets.length}`)
            .join(', ');

          const projectContext = `
Project: ${group.project.name}
Description: ${group.project.description || 'No description'}
State: ${group.project.state}
Progress: ${group.project.progress}%
Target Date: ${group.project.targetDate || 'Not set'}
Lead: ${group.project.lead?.name || 'Not assigned'}

Ticket Statistics:
- Total: ${group.stats.total}
- Completed: ${group.stats.completed}
- In Progress: ${group.stats.inProgress}
- Blocked: ${group.stats.blocked}
- Average Priority: ${group.stats.avgPriority.toFixed(1)}

State Distribution: ${stateDistribution}
Assignee Distribution: ${assigneeDistribution}

Sample Tickets (${Math.min(ticketSummary.length, 50)} of ${group.tickets.length}):
${JSON.stringify(ticketSummary, null, 2)}
`;

          const response = await model.invoke([
            new SystemMessage(`You are analyzing a software project from Linear. Provide a comprehensive analysis in JSON format with these fields:
- summary: Brief 1-2 sentence summary of what this project is about
- purpose: What problem does this project solve or what value does it deliver?
- currentState: Current state of the project (early stage, mid-development, near completion, maintenance, etc.)
- keyFeatures: Array of 3-5 key features or capabilities being built
- risks: Array of potential risks based on ticket patterns
- blockers: Array of current blockers or issues needing immediate attention
- recommendations: Array of actionable recommendations
- healthScore: Number 0-100 representing overall project health

Be specific and actionable. Base your analysis on the ticket data provided.`),
            new HumanMessage(projectContext),
          ]);

          // Parse the LLM response
          const responseText =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content);

          // Try to extract JSON from the response
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            projectAnalyses.push({
              projectId,
              projectName: group.project.name,
              summary: analysis.summary || '',
              purpose: analysis.purpose || '',
              currentState: analysis.currentState || 'unknown',
              keyFeatures: analysis.keyFeatures || [],
              risks: analysis.risks || [],
              blockers: analysis.blockers || [],
              recommendations: analysis.recommendations || [],
              healthScore: analysis.healthScore || 50,
              teamMembers: Object.keys(group.ticketsByAssignee),
            });
          }
        } catch (err) {
          logger.warn(
            `Failed to analyze project ${group.project.name}: ${err}`,
          );
          // Add a basic analysis without LLM
          projectAnalyses.push({
            projectId,
            projectName: group.project.name,
            summary: group.project.description || 'No description available',
            purpose: 'Unable to determine',
            currentState: group.project.state,
            keyFeatures: [],
            risks:
              group.stats.blocked > 0
                ? [`${group.stats.blocked} blocked tickets`]
                : [],
            blockers: [],
            recommendations: [],
            healthScore: Math.round(
              (group.stats.completed / Math.max(group.stats.total, 1)) * 100,
            ),
            teamMembers: Object.keys(group.ticketsByAssignee),
          });
        }
      }

      logger.debug(`Completed analysis for ${projectAnalyses.length} projects`);

      return { projectAnalyses };
    };

    const llmAnalysis = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      try {
        if (!state.organization || state.teams.length === 0) {
          return { llmObservations: [], phase: 'detect_inbox' };
        }

        const structuredModel = model.withStructuredOutput(
          LLMObservationsSchema,
          { name: 'analyze_linear_workspace' },
        );

        // Build comprehensive context for LLM
        const projectSummaries = state.projectAnalyses
          .map(
            (p) =>
              `- ${p.projectName}: ${p.summary} (Health: ${p.healthScore}%)`,
          )
          .join('\n');

        const context = `
Organization: ${state.organization.name}
Teams: ${state.teams.map((t) => `${t.name} (${t.key})`).join(', ')}
Members: ${state.members.length} active users
Projects: ${state.projects.length} (avg ${Math.round(state.projects.reduce((s, p) => s + p.progress, 0) / Math.max(state.projects.length, 1))}% complete)
Active Cycles: ${state.cycles.filter((c) => !c.completedAt).length}
Total Issues: ${state.recentTickets.length}
Labels: ${state.labels.length}
Workflow States: ${[...new Set(state.workflowStates.map((s) => s.name))].join(', ')}

Project Summaries:
${projectSummaries}

Ticket Patterns:
${state.ticketPatterns.map((p) => `- ${p.type}: ${p.description}`).join('\n')}

Team Insights:
${state.teamInsights.map((i) => `- ${i.type}: ${i.description}`).join('\n')}
`;

        const result = await structuredModel.invoke([
          new SystemMessage(
            `You are analyzing a software team's Linear workspace. Based on the data provided, identify:
1. Team dynamics - collaboration patterns, workload distribution
2. Workflow efficiency - bottlenecks, process improvements
3. Project health - risks, blockers, areas needing attention
4. Recommendations - specific, actionable improvements

Return 3-5 high-value observations with appropriate types and importance scores (0-1).
Focus on insights that would help a team lead or project manager make better decisions.`,
          ),
          new HumanMessage(context),
        ]);

        logger.debug(
          `LLM generated ${result.observations.length} observations`,
        );

        return {
          llmObservations: result.observations,
          phase: 'detect_inbox',
        };
      } catch (err) {
        logger.warn(`LLM analysis failed for Linear onboarding: ${err}`);
        return {
          llmObservations: [],
          phase: 'detect_inbox',
        };
      }
    };

    const detectInboxItems = async (
      state: LinearOnboardingState,
    ): Promise<Partial<LinearOnboardingState>> => {
      const inboxCandidates: InboxItemCandidate[] = [];

      logger.debug('Detecting inbox items from Linear data');

      // Detect blockers from tickets
      const blockerTickets = state.recentTickets.filter(
        (t) =>
          t.labels.some((l) => l.name.toLowerCase().includes('block')) ||
          t.priority === 1,
      );

      for (const ticket of blockerTickets.slice(0, 10)) {
        inboxCandidates.push({
          id: `inbox-linear-blocker-${ticket.id}`,
          workspaceId: state.workspaceId,
          type: 'blocker',
          priority: ticket.priority === 1 ? 'critical' : 'high',
          title: `🚨 Blocker: ${ticket.identifier} - ${ticket.title.slice(0, 60)}`,
          summary: `${ticket.state.name} | Assigned to: ${ticket.assignee?.name || 'Unassigned'} | Project: ${ticket.project?.name || 'No project'}`,
          confidence: 0.9,
          sourceMemoryIds: [],
          suggestedActions: [
            'Review and address blocker',
            'Escalate if needed',
            'Update stakeholders',
          ],
          requiresApproval: false,
          entityRefs: {
            ticketIds: [ticket.id],
          },
          createdAt: new Date(),
        });
      }

      // Detect at-risk projects
      for (const analysis of state.projectAnalyses) {
        if (analysis.healthScore < 50 || analysis.blockers.length > 0) {
          inboxCandidates.push({
            id: `inbox-linear-project-risk-${analysis.projectId}`,
            workspaceId: state.workspaceId,
            type: 'risk',
            priority: analysis.healthScore < 30 ? 'critical' : 'high',
            title: `⚠️ Project at Risk: ${analysis.projectName}`,
            summary: `Health Score: ${analysis.healthScore}% | ${analysis.blockers.length} blockers | ${analysis.risks.join(', ') || 'Review needed'}`,
            confidence: 0.85,
            sourceMemoryIds: [],
            suggestedActions: analysis.recommendations.slice(0, 3),
            requiresApproval: false,
            entityRefs: {},
            createdAt: new Date(),
          });
        }
      }

      // Detect overloaded team members
      for (const [, group] of state.ticketsByUser) {
        if (group.stats.highPriority > 5 || group.stats.inProgress > 10) {
          inboxCandidates.push({
            id: `inbox-linear-workload-${group.user.id}`,
            workspaceId: state.workspaceId,
            type: 'action_required',
            priority: group.stats.highPriority > 8 ? 'high' : 'medium',
            title: `📊 High Workload: ${group.user.name}`,
            summary: `${group.stats.total} total tickets | ${group.stats.inProgress} in progress | ${group.stats.highPriority} high priority`,
            confidence: 0.8,
            sourceMemoryIds: [],
            suggestedActions: [
              'Review workload distribution',
              'Consider reassigning some tickets',
              'Check for blockers',
            ],
            requiresApproval: false,
            entityRefs: {
              userIds: [group.user.id],
            },
            createdAt: new Date(),
          });
        }
      }

      // Detect milestone/sprint risks
      for (const [, group] of state.ticketsByMilestone) {
        if (!group.stats.onTrack && group.stats.total > 0) {
          const completionRate = Math.round(
            (group.stats.completed / group.stats.total) * 100,
          );
          inboxCandidates.push({
            id: `inbox-linear-sprint-risk-${group.milestone.id}`,
            workspaceId: state.workspaceId,
            type: 'drift',
            priority: completionRate < 30 ? 'high' : 'medium',
            title: `📅 Sprint Behind Schedule: ${group.milestone.name}`,
            summary: `${completionRate}% complete | ${group.stats.total - group.stats.completed} tickets remaining | Target: ${group.milestone.targetDate || 'Not set'}`,
            confidence: 0.85,
            sourceMemoryIds: [],
            suggestedActions: [
              'Review sprint scope',
              'Identify blockers',
              'Consider scope adjustment',
            ],
            requiresApproval: false,
            entityRefs: {},
            createdAt: new Date(),
          });
        }
      }

      logger.debug(`Detected ${inboxCandidates.length} inbox items`);

      return { inboxCandidates, phase: 'creating_memories' };
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
        // Save organization memory
        if (state.organization) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'team' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              type: 'linear_organization',
              organization: state.organization,
              teams: state.teams,
              memberCount: state.members.length,
              projectCount: state.projects.length,
            }),
            summary: `Linear organization: ${state.organization.name} with ${state.teams.length} teams`,
            importance: 0.9,
            confidence: 1,
            sourceEventIds: [],
            relatedEntityIds: state.teams.map((t) => `linear:team:${t.id}`),
            relatedMemoryIds: [],
            entityRefs: {
              teamIds: state.teams.map((t) => t.id),
            },
          });
          memoriesCreated.push(memory.id);
        }

        // Save team members memory
        if (state.members.length > 0) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'team' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              type: 'linear_team_members',
              members: state.members.map((m) => ({
                id: m.id,
                name: m.name,
                email: m.email,
                isAdmin: m.isAdmin,
              })),
            }),
            summary: `Linear team: ${state.members.length} members (${state.members.filter((m) => m.isAdmin).length} admins)`,
            importance: 0.7,
            confidence: 1,
            sourceEventIds: [],
            relatedEntityIds: state.members.map((m) => `linear:user:${m.id}`),
            relatedMemoryIds: [],
            entityRefs: {
              userIds: state.members.map((m) => m.id),
            },
          });
          memoriesCreated.push(memory.id);
        }

        // Save detailed project memories with tickets grouped by project
        for (const [projectId, group] of state.ticketsByProject) {
          const analysis = state.projectAnalyses.find(
            (a) => a.projectId === projectId,
          );

          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'project' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              type: 'linear_project_detail',
              project: group.project,
              analysis: analysis || null,
              stats: group.stats,
              ticketsByState: Object.fromEntries(
                Object.entries(group.ticketsByState).map(([state, tickets]) => [
                  state,
                  tickets.map((t) => ({
                    id: t.identifier,
                    title: t.title,
                    priority: t.priorityLabel,
                    assignee: t.assignee?.name,
                  })),
                ]),
              ),
              ticketsByAssignee: Object.fromEntries(
                Object.entries(group.ticketsByAssignee).map(
                  ([assignee, tickets]) => [assignee, tickets.length],
                ),
              ),
              totalTickets: group.tickets.length,
            }),
            summary: analysis
              ? `Project "${group.project.name}": ${analysis.summary} (Health: ${analysis.healthScore}%)`
              : `Project "${group.project.name}": ${group.stats.total} tickets, ${group.stats.completed} completed`,
            importance: 0.85,
            confidence: 1,
            sourceEventIds: [],
            relatedEntityIds: [`linear:project:${projectId}`],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
        }

        // Save milestone/sprint memories
        for (const [milestoneId, group] of state.ticketsByMilestone) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'project' as MemoryNamespace,
            category: 'progress',
            content: JSON.stringify({
              type: 'linear_milestone_detail',
              milestone: group.milestone,
              stats: group.stats,
              ticketsByProject: Object.fromEntries(
                Object.entries(group.ticketsByProject).map(
                  ([project, tickets]) => [
                    project,
                    {
                      count: tickets.length,
                      completed: tickets.filter(
                        (t) => t.state.type === 'completed',
                      ).length,
                    },
                  ],
                ),
              ),
            }),
            summary: `Sprint "${group.milestone.name}": ${group.stats.completed}/${group.stats.total} completed, ${group.stats.onTrack ? 'On Track' : 'At Risk'}`,
            importance: 0.7,
            confidence: 1,
            sourceEventIds: [],
            relatedEntityIds: [`linear:cycle:${milestoneId}`],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
        }

        // Save user workload memories
        for (const [userId, group] of state.ticketsByUser) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'team' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              type: 'linear_user_workload',
              user: group.user,
              stats: group.stats,
              ticketsByProject: Object.fromEntries(
                Object.entries(group.ticketsByProject).map(
                  ([project, tickets]) => [project, tickets.length],
                ),
              ),
              ticketsByState: Object.fromEntries(
                Object.entries(group.ticketsByState).map(([state, tickets]) => [
                  state,
                  tickets.length,
                ]),
              ),
            }),
            summary: `${group.user.name}: ${group.stats.total} tickets (${group.stats.inProgress} in progress, ${group.stats.highPriority} high priority)`,
            importance: 0.6,
            confidence: 1,
            sourceEventIds: [],
            relatedEntityIds: [`linear:user:${userId}`],
            relatedMemoryIds: [],
            entityRefs: {
              userIds: [userId],
            },
          });
          memoriesCreated.push(memory.id);
        }

        // Save workflow configuration memory
        if (state.workflowStates.length > 0 || state.labels.length > 0) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'team' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              type: 'linear_workflow_config',
              workflowStates: state.workflowStates,
              labels: state.labels,
              cycles: state.cycles,
            }),
            summary: `Linear workflow: ${state.workflowStates.length} states, ${state.labels.length} labels`,
            importance: 0.6,
            confidence: 1,
            sourceEventIds: [],
            relatedEntityIds: [],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
        }

        // Save ticket patterns memory
        if (state.ticketPatterns.length > 0) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'ticket' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              type: 'linear_ticket_patterns',
              patterns: state.ticketPatterns,
              analyzedTickets: state.recentTickets.length,
            }),
            summary: `Linear ticket patterns from ${state.recentTickets.length} issues`,
            importance: 0.7,
            confidence: 0.9,
            sourceEventIds: [],
            relatedEntityIds: [],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
        }

        // Save LLM observations as individual memories
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

        // Save inbox candidates as memories and potentially create inbox threads
        if (state.inboxCandidates.length > 0) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'team' as MemoryNamespace,
            category: 'risk',
            content: JSON.stringify({
              type: 'linear_inbox_candidates',
              candidates: state.inboxCandidates,
              summary: {
                blockers: state.inboxCandidates.filter(
                  (c) => c.type === 'blocker',
                ).length,
                risks: state.inboxCandidates.filter((c) => c.type === 'risk')
                  .length,
                drifts: state.inboxCandidates.filter((c) => c.type === 'drift')
                  .length,
                actionRequired: state.inboxCandidates.filter(
                  (c) => c.type === 'action_required',
                ).length,
              },
            }),
            summary: `Linear onboarding detected ${state.inboxCandidates.length} items requiring attention`,
            importance: 0.9,
            confidence: 0.85,
            sourceEventIds: [],
            relatedEntityIds: [],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
        }

        logger.log(
          `Created ${memoriesCreated.length} memories for Linear onboarding (${state.ticketsByProject.size} projects, ${state.inboxCandidates.length} inbox items)`,
        );

        return { memoriesCreated, phase: 'complete' };
      } catch (err) {
        logger.error(`Failed to create memories: ${err}`);
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
      .addNode('fetchOrganizationAndTeams', fetchOrganizationAndTeams)
      .addNode('fetchMembers', fetchMembers)
      .addNode('fetchProjects', fetchProjects)
      .addNode('fetchCyclesAndLabels', fetchCyclesAndLabels)
      .addNode('fetchTickets', fetchTickets)
      .addNode('groupTickets', groupTickets)
      .addNode('analyze', analyze)
      .addNode('analyzeProjects', analyzeProjects)
      .addNode('llmAnalysis', llmAnalysis)
      .addNode('detectInboxItems', detectInboxItems)
      .addNode('createMemories', createMemories)
      .addEdge(START, 'fetchOrganizationAndTeams')
      .addEdge('fetchOrganizationAndTeams', 'fetchMembers')
      .addEdge('fetchMembers', 'fetchProjects')
      .addEdge('fetchProjects', 'fetchCyclesAndLabels')
      .addEdge('fetchCyclesAndLabels', 'fetchTickets')
      .addEdge('fetchTickets', 'groupTickets')
      .addEdge('groupTickets', 'analyze')
      .addEdge('analyze', 'analyzeProjects')
      .addEdge('analyzeProjects', 'llmAnalysis')
      .addEdge('llmAnalysis', 'detectInboxItems')
      .addConditionalEdges('detectInboxItems', shouldContinue, {
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
