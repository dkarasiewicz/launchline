import { Inject, Injectable, Logger } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  LinearClient,
  PaginationOrderBy,
  PaginationSortOrder,
} from '@linear/sdk';
import { LINEA_CHECKPOINTER, LINEA_MODEL_ANALYSIS } from '../tokens';
import { MemoryService } from './memory.service';
import {
  LLMObservationsSchema,
  type GraphContext,
  type InboxItemCandidate,
  type LLMObservation,
  type MemoryNamespace,
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

type LinearOnboardingState = typeof LinearOnboardingStateAnnotation.State;

type OnboardingPhase =
  | 'fetching'
  | 'analyzing'
  | 'llm_analysis'
  | 'detect_inbox'
  | 'creating_memories'
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

@Injectable()
export class LinearOnboardingGraphsService {
  private readonly logger = new Logger(LinearOnboardingGraphsService.name);
  private graph: ReturnType<typeof this.createLinearOnboardingGraph> | null =
    null;

  constructor(
    @Inject(LINEA_CHECKPOINTER)
    private readonly checkpointer: PostgresSaver,
    @Inject(LINEA_MODEL_ANALYSIS)
    private readonly modelAnalysis: BaseChatModel,
    private readonly memoryService: MemoryService,
  ) {}

  getGraph() {
    if (!this.graph) {
      this.graph = this.createLinearOnboardingGraph();
    }

    return this.graph;
  }
  private createLinearOnboardingGraph() {
    const memoryService = this.memoryService;
    const model = this.modelAnalysis;
    const logger = this.logger;
    const linearRequestTimeoutMs = Number(
      process.env['LINEAR_REQUEST_TIMEOUT_MS'] || '15000',
    );

    const withLinearTimeout = async <T>(
      promise: Promise<T> | T,
      label: string,
    ): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(`${label} timed out after ${linearRequestTimeoutMs}ms`),
          );
        }, linearRequestTimeoutMs);
      });

      return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(
        () => {
          if (timeoutId) clearTimeout(timeoutId);
        },
      );
    };

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
        const organization = await withLinearTimeout(
          client.organization,
          'Linear organization fetch',
        );
        const orgData: LinearOrganization = {
          id: organization.id,
          name: organization.name,
          urlKey: organization.urlKey,
          logoUrl: organization.logoUrl ?? undefined,
          createdAt: organization.createdAt.toISOString(),
        };

        logger.debug(
          {
            organization: orgData,
          },
          'Fetched organization info',
        );

        // Fetch teams
        const teamsResponse = await withLinearTimeout(
          client.teams(),
          'Linear teams fetch',
        );
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
        logger.error({ err }, 'Failed to fetch organization/teams');
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

        const usersResponse = await withLinearTimeout(
          client.users(),
          'Linear members fetch',
        );
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
        logger.error({ err }, 'Failed to fetch members');
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
        const projectsResponse = await withLinearTimeout(
          client.projects({
            first: 50,
            orderBy: PaginationOrderBy.UpdatedAt,
          }),
          'Linear projects fetch',
        );

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
        const milestonesResponse = await withLinearTimeout(
          client.projectMilestones({
            first: 50,
          }),
          'Linear milestones fetch',
        );
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
        logger.error({ err }, 'Failed to fetch projects');
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
          const teamObj = await withLinearTimeout(
            client.team(team.id),
            `Linear team fetch ${team.id}`,
          );
          const cyclesResponse = await withLinearTimeout(
            teamObj.cycles({ first: 10 }),
            `Linear cycles fetch ${team.id}`,
          );
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
        const labelsResponse = await withLinearTimeout(
          client.issueLabels({ first: 100 }),
          'Linear labels fetch',
        );
        const labels: LinearLabel[] = await Promise.all(
          labelsResponse.nodes.map(async (label) => {
            const team = await withLinearTimeout(
              label.team,
              `Linear label team fetch ${label.id}`,
            );
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
          const teamObj = await withLinearTimeout(
            client.team(team.id),
            `Linear team fetch ${team.id}`,
          );
          const statesResponse = await withLinearTimeout(
            teamObj.states(),
            `Linear workflow states fetch ${team.id}`,
          );
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
        logger.error({ err }, 'Failed to fetch cycles/labels');
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

          const issuesResponse = await withLinearTimeout(
            client.issues({
              first: pageSize,
              after: endCursor,
              orderBy: PaginationOrderBy.UpdatedAt,
              filter: state.linearTeamId
                ? { team: { id: { eq: state.linearTeamId } } }
                : undefined,
            }),
            `Linear issues fetch page ${pageCount}`,
          );

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
            { maxPages, totalIssues: allTickets.length },
            'Reached max page limit, stopping pagination',
          );
        }

        logger.debug(`Fetched total of ${allTickets.length} issues`);

        return { recentTickets: allTickets, phase: 'analyzing' };
      } catch (err) {
        logger.error({ err }, 'Failed to fetch issues');
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
            { err, projectName: group.project.name },
            'Failed to analyze project',
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
        logger.warn({ err }, 'LLM analysis failed for Linear onboarding');
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

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(
        now.getTime() - 14 * 24 * 60 * 60 * 1000,
      );

      // 1. Detect blockers from tickets (labeled or high priority)
      const blockerTickets = state.recentTickets.filter(
        (t) =>
          t.state.type !== 'completed' &&
          t.state.type !== 'canceled' &&
          (t.labels.some((l) => l.name.toLowerCase().includes('block')) ||
            t.priority === 1),
      );

      for (const ticket of blockerTickets.slice(0, 5)) {
        inboxCandidates.push({
          id: `inbox-linear-blocker-${ticket.id}`,
          workspaceId: state.workspaceId,
          type: 'blocker',
          priority: ticket.priority === 1 ? 'critical' : 'high',
          title: `🚨 Blocker: ${ticket.identifier} - ${ticket.title.slice(0, 60)}`,
          summary: `${ticket.state.name} | Assigned to: ${ticket.assignee?.name || 'Unassigned'} | Project: ${ticket.project?.name || 'No project'}`,
          confidence: 0.95,
          sourceMemoryIds: [],
          suggestedActions: [
            `Review ${ticket.identifier} to understand the blocker`,
            ticket.assignee
              ? `Check with ${ticket.assignee.name} on status`
              : 'Assign someone to unblock',
            'Update stakeholders on blockers',
          ],
          requiresApproval: false,
          entityRefs: {
            ticketIds: [ticket.id],
          },
          createdAt: new Date(),
        });
      }

      // 2. Detect stalled work (no updates in 7+ days, still in progress)
      const stalledTickets = state.recentTickets.filter(
        (t) =>
          t.state.type === 'started' && new Date(t.updatedAt) < sevenDaysAgo,
      );

      for (const ticket of stalledTickets.slice(0, 5)) {
        const daysSinceUpdate = Math.floor(
          (now.getTime() - new Date(ticket.updatedAt).getTime()) /
            (24 * 60 * 60 * 1000),
        );
        inboxCandidates.push({
          id: `inbox-linear-stalled-${ticket.id}`,
          workspaceId: state.workspaceId,
          type: 'stalled',
          priority: daysSinceUpdate > 14 ? 'high' : 'medium',
          title: `⏸️ Stalled Work: ${ticket.identifier} - ${ticket.title.slice(0, 50)}`,
          summary: `No updates for ${daysSinceUpdate} days | ${ticket.state.name} | ${ticket.assignee?.name || 'Unassigned'}`,
          confidence: 0.9,
          sourceMemoryIds: [],
          suggestedActions: [
            `Check in with ${ticket.assignee?.name || 'the team'} about ${ticket.identifier}`,
            'Determine if the ticket is still relevant',
            'Consider reassigning or breaking it down',
          ],
          requiresApproval: false,
          entityRefs: {
            ticketIds: [ticket.id],
          },
          createdAt: new Date(),
        });
      }

      // 3. Detect unassigned high-priority tickets
      const unassignedHighPriority = state.recentTickets.filter(
        (t) =>
          !t.assignee &&
          t.priority <= 2 &&
          t.state.type !== 'completed' &&
          t.state.type !== 'canceled',
      );

      if (unassignedHighPriority.length > 0) {
        inboxCandidates.push({
          id: `inbox-linear-unassigned-${Date.now()}`,
          workspaceId: state.workspaceId,
          type: 'action_required',
          priority: 'high',
          title: `📋 ${unassignedHighPriority.length} High-Priority Tickets Need Owners`,
          summary: `Unassigned: ${unassignedHighPriority
            .slice(0, 3)
            .map((t) => t.identifier)
            .join(
              ', ',
            )}${unassignedHighPriority.length > 3 ? ` (+${unassignedHighPriority.length - 3} more)` : ''}`,
          confidence: 0.95,
          sourceMemoryIds: [],
          suggestedActions: [
            'Review and assign tickets based on expertise',
            'Check team capacity before assigning',
            'Consider breaking large tickets into smaller ones',
          ],
          requiresApproval: false,
          entityRefs: {
            ticketIds: unassignedHighPriority.slice(0, 10).map((t) => t.id),
          },
          createdAt: new Date(),
        });
      }

      // 4. Detect at-risk projects
      for (const analysis of state.projectAnalyses) {
        if (analysis.healthScore < 50 || analysis.blockers.length > 0) {
          inboxCandidates.push({
            id: `inbox-linear-project-risk-${analysis.projectId}`,
            workspaceId: state.workspaceId,
            type: 'risk',
            priority: analysis.healthScore < 30 ? 'critical' : 'high',
            title: `⚠️ Project at Risk: ${analysis.projectName}`,
            summary: `Health: ${analysis.healthScore}% | ${analysis.blockers.length > 0 ? `Blockers: ${analysis.blockers[0]}` : analysis.risks[0] || 'Review needed'}`,
            confidence: 0.85,
            sourceMemoryIds: [],
            suggestedActions: analysis.recommendations.slice(0, 3),
            requiresApproval: false,
            entityRefs: {},
            createdAt: new Date(),
          });
        }
      }

      // 5. Detect workload imbalance
      const userWorkloads = Array.from(state.ticketsByUser.values());
      const avgWorkload =
        userWorkloads.reduce((sum, g) => sum + g.stats.total, 0) /
        Math.max(userWorkloads.length, 1);

      const overloadedUsers = userWorkloads.filter(
        (g) => g.stats.total > avgWorkload * 1.5 && g.stats.inProgress > 5,
      );

      for (const group of overloadedUsers.slice(0, 3)) {
        inboxCandidates.push({
          id: `inbox-linear-workload-${group.user.id}`,
          workspaceId: state.workspaceId,
          type: 'coverage',
          priority: group.stats.highPriority > 5 ? 'high' : 'medium',
          title: `📊 High Workload: ${group.user.name}`,
          summary: `${group.stats.total} tickets (${Math.round((group.stats.total / avgWorkload - 1) * 100)}% above average) | ${group.stats.inProgress} in progress | ${group.stats.highPriority} urgent`,
          confidence: 0.8,
          sourceMemoryIds: [],
          suggestedActions: [
            'Review workload distribution with the team',
            `Check if ${group.user.name} needs support`,
            'Consider redistributing some tickets',
          ],
          requiresApproval: false,
          entityRefs: {
            userIds: [group.user.id],
          },
          createdAt: new Date(),
        });
      }

      // 6. Detect sprint/cycle risks
      for (const [, group] of state.ticketsByMilestone) {
        if (!group.stats.onTrack && group.stats.total > 0) {
          const completionRate = Math.round(
            (group.stats.completed / group.stats.total) * 100,
          );
          const remaining = group.stats.total - group.stats.completed;

          inboxCandidates.push({
            id: `inbox-linear-sprint-risk-${group.milestone.id}`,
            workspaceId: state.workspaceId,
            type: 'drift',
            priority: completionRate < 30 ? 'high' : 'medium',
            title: `📅 Sprint at Risk: ${group.milestone.name}`,
            summary: `${completionRate}% complete | ${remaining} tickets remaining | Target: ${group.milestone.targetDate ? new Date(group.milestone.targetDate).toLocaleDateString() : 'Not set'}`,
            confidence: 0.85,
            sourceMemoryIds: [],
            suggestedActions: [
              'Review remaining scope with the team',
              'Identify and remove blockers',
              'Consider descoping low-priority items',
            ],
            requiresApproval: false,
            entityRefs: {},
            createdAt: new Date(),
          });
        }
      }

      // 7. Surface hidden contributions (people with few closed tickets but high activity)
      const hiddenContributors = userWorkloads.filter((g) => {
        const closedRatio = g.stats.completed / Math.max(g.stats.total, 1);
        // Low closed ratio but has many in-progress items = might be doing complex work
        return (
          closedRatio < 0.3 && g.stats.inProgress >= 3 && g.stats.total >= 5
        );
      });

      if (hiddenContributors.length > 0) {
        for (const group of hiddenContributors.slice(0, 2)) {
          inboxCandidates.push({
            id: `inbox-linear-contributor-${group.user.id}`,
            workspaceId: state.workspaceId,
            type: 'update',
            priority: 'low',
            title: `💡 Check In: ${group.user.name}'s workload`,
            summary: `${group.stats.completed} completed vs ${group.stats.inProgress} in progress - might be working on complex items or blocked`,
            confidence: 0.7,
            sourceMemoryIds: [],
            suggestedActions: [
              `Ask ${group.user.name} if they need help with current work`,
              'Review if in-progress tickets are blocked',
              'Consider if work breakdown could help',
            ],
            requiresApproval: false,
            entityRefs: {
              userIds: [group.user.id],
            },
            createdAt: new Date(),
          });
        }
      }

      logger.debug(
        `Detected ${inboxCandidates.length} inbox items from Linear onboarding`,
      );

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
        logger.error({ err }, 'Failed to create memories');
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
}
