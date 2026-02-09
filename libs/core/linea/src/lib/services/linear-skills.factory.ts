import { Injectable, Logger } from '@nestjs/common';
import { type StructuredToolInterface, tool } from '@langchain/core/tools';
import { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { LinearClient } from '@linear/sdk';
import {
  IntegrationFacade,
  IntegrationType,
  LinearService,
} from '@launchline/core-integration';

/**
 * Linear Skills Factory
 *
 * Creates tools (skills) for interacting with Linear API.
 * These are real integrations that execute actions in Linear.
 *
 * Skills follow the DeepAgent pattern - they're tools that extend
 * the agent's capabilities through external integrations.
 */

// Input schemas for Linear tools
const GetLinearIssuesSchema = z.object({
  filter: z
    .enum(['my_issues', 'team_issues', 'blockers', 'stalled', 'recent'])
    .default('recent')
    .describe('Filter for issues to retrieve'),
  teamId: z.string().optional().describe('Specific team ID to filter by'),
  assignee: z
    .string()
    .optional()
    .describe('Assignee name or email to filter by'),
  assigneeId: z
    .string()
    .optional()
    .describe('Assignee ID to filter by (preferred when known)'),
  limit: z.number().default(10).describe('Maximum number of issues to return'),
});

const GetLinearIssueDetailsSchema = z.object({
  issueId: z
    .string()
    .describe('Linear issue ID or identifier (e.g., TEAM-123)'),
});

const SearchLinearIssuesSchema = z.object({
  query: z.string().describe('Search query for Linear issues'),
  includeArchived: z
    .boolean()
    .default(false)
    .describe('Include archived issues'),
  limit: z.number().default(10).describe('Maximum results'),
});

const GetLinearProjectStatusSchema = z.object({
  projectId: z.string().optional().describe('Specific project ID'),
  includeCompleted: z
    .boolean()
    .default(false)
    .describe('Include completed milestones'),
});

const GetLinearTeamWorkloadSchema = z.object({
  teamId: z.string().optional().describe('Team ID (uses default if not set)'),
  includeUnassigned: z
    .boolean()
    .default(true)
    .describe('Include unassigned issues'),
});

const AddLinearCommentSchema = z.object({
  issueId: z.string().describe('Issue ID to comment on'),
  body: z.string().describe('Comment content (markdown supported)'),
});

const CreateLinearIssueSchema = z.object({
  title: z.string().describe('Issue title'),
  description: z
    .string()
    .optional()
    .describe('Issue description (markdown supported)'),
  teamId: z
    .string()
    .optional()
    .describe('Team ID, key, or name (defaults to first team)'),
  projectId: z.string().optional().describe('Project ID'),
  assigneeId: z.string().optional().describe('Assignee user ID'),
  priority: z
    .number()
    .int()
    .min(0)
    .max(4)
    .optional()
    .describe('Priority (0=none, 1=urgent, 2=high, 3=medium, 4=low)'),
  labelIds: z.array(z.string()).optional().describe('Label IDs to apply'),
});

const GetLinearCycleStatusSchema = z.object({
  cycleId: z
    .string()
    .optional()
    .describe('Specific cycle ID (uses active if not set)'),
  teamId: z.string().optional().describe('Team ID for active cycle lookup'),
});

function getWorkspaceId(config: RunnableConfig): string {
  const configurable = config?.configurable as
    | Record<string, unknown>
    | undefined;
  return (configurable?.['workspaceId'] as string) || 'default';
}

type TeamSummary = {
  id: string;
  name?: string | null;
  key?: string | null;
};

function formatTeamLabel(team: TeamSummary) {
  const name = team.name?.trim() || 'Unnamed team';
  return team.key ? `${name} (${team.key})` : name;
}

@Injectable()
export class LinearSkillsFactory {
  private readonly logger = new Logger(LinearSkillsFactory.name);

  constructor(
    private readonly integrationFacade: IntegrationFacade,
    private readonly linearService: LinearService,
  ) {}

  /**
   * Create all Linear skills (tools)
   */
  createLinearSkills(): StructuredToolInterface[] {
    return [
      this.createGetLinearIssuesTool(),
      this.createGetLinearIssueDetailsTool(),
      this.createSearchLinearIssuesTool(),
      this.createGetLinearProjectStatusTool(),
      this.createGetLinearTeamWorkloadTool(),
      this.createGetLinearCycleStatusTool(),
      this.createAddLinearCommentTool(),
      this.createCreateLinearIssueTool(),
    ];
  }

  /**
   * Get a Linear client for the workspace
   */
  private async getLinearClient(
    workspaceId: string,
  ): Promise<LinearClient | null> {
    try {
      const integrations = await this.integrationFacade.getIntegrationsByType(
        workspaceId,
        IntegrationType.LINEAR,
      );

      if (integrations.length === 0) {
        return null;
      }

      const accessToken = await this.integrationFacade.getAccessToken(
        integrations[0].id,
      );

      if (!accessToken) {
        return null;
      }

      return this.linearService.createClient(accessToken);
    } catch (error) {
      this.logger.error('Failed to get Linear client', error);
      return null;
    }
  }

  /**
   * Get Linear issues based on filter
   */
  private createGetLinearIssuesTool(): StructuredToolInterface {
    const getClient = this.getLinearClient.bind(this);
    const logger = this.logger;

    return tool(
      async ({ filter, teamId, assignee, assigneeId, limit }, config) => {
        const workspaceId = getWorkspaceId(config);
        const client = await getClient(workspaceId);

        if (!client) {
          return '❌ Linear integration not connected. Please connect Linear in Settings > Integrations.';
        }

        try {
          const resolvedAssigneeId = await (async () => {
            if (assigneeId) {
              return assigneeId;
            }
            if (!assignee) {
              return undefined;
            }

            const normalized = assignee.trim().toLowerCase();
            if (!normalized) {
              return undefined;
            }

            const usersResponse = await client.users({ first: 200 });
            const users = usersResponse.nodes || [];

            const exact = users.find((user) => {
              const name = user.name?.toLowerCase();
              const display = user.displayName?.toLowerCase();
              const email = user.email?.toLowerCase();
              return (
                name === normalized ||
                display === normalized ||
                email === normalized
              );
            });
            if (exact) {
              return exact.id;
            }

            const partialMatches = users.filter((user) => {
              const name = user.name?.toLowerCase() || '';
              const display = user.displayName?.toLowerCase() || '';
              const email = user.email?.toLowerCase() || '';
              return (
                name.includes(normalized) ||
                display.includes(normalized) ||
                email.includes(normalized)
              );
            });

            if (partialMatches.length === 1) {
              return partialMatches[0].id;
            }

            if (partialMatches.length > 1) {
              const sample = partialMatches
                .slice(0, 5)
                .map((user) => `${user.name} (${user.email || 'no email'})`)
                .join(', ');
              return `__AMBIGUOUS__:${sample}`;
            }

            return `__NOT_FOUND__:${assignee}`;
          })();

          if (resolvedAssigneeId?.startsWith('__NOT_FOUND__')) {
            return `No Linear user found matching "${assignee}". Try a full name, email, or provide assigneeId.`;
          }

          if (resolvedAssigneeId?.startsWith('__AMBIGUOUS__')) {
            const sample = resolvedAssigneeId.replace('__AMBIGUOUS__:', '');
            return `Multiple users match "${assignee}". Please provide assigneeId or a more specific name. Matches: ${sample}`;
          }

          const assigneeFilter = resolvedAssigneeId
            ? { assignee: { id: { eq: resolvedAssigneeId } } }
            : {};
          const teamFilter = teamId ? { team: { id: { eq: teamId } } } : {};
          let issues;
          const viewer = await client.viewer;

          switch (filter) {
            case 'my_issues':
              if (resolvedAssigneeId) {
                issues = await client.issues({
                  first: limit,
                  filter: {
                    state: { type: { nin: ['completed', 'canceled'] } },
                    ...assigneeFilter,
                    ...teamFilter,
                  },
                });
              } else {
                issues = await viewer.assignedIssues({
                  first: limit,
                  filter: {
                    state: { type: { nin: ['completed', 'canceled'] } },
                  },
                });
              }
              break;

            case 'team_issues': {
              if (!teamId && !resolvedAssigneeId) {
                const teams = await viewer.teams();
                const firstTeam = teams.nodes[0];
                if (!firstTeam) {
                  return 'No teams found.';
                }
                issues = await firstTeam.issues({
                  first: limit,
                  filter: {
                    state: { type: { nin: ['completed', 'canceled'] } },
                  },
                });
              } else {
                issues = await client.issues({
                  first: limit,
                  filter: {
                    state: { type: { nin: ['completed', 'canceled'] } },
                    ...teamFilter,
                    ...assigneeFilter,
                  },
                });
              }
              break;
            }

            case 'blockers':
              // Search for issues with "blocked" in title or description
              issues = await client.issues({
                first: limit,
                filter: {
                  state: { type: { nin: ['completed', 'canceled'] } },
                  ...teamFilter,
                  ...assigneeFilter,
                },
              });
              // Filter client-side for blocked mentions
              issues = {
                ...issues,
                nodes: issues.nodes.filter(
                  (i) =>
                    i.title.toLowerCase().includes('blocked') ||
                    (i.description &&
                      i.description.toLowerCase().includes('blocked')),
                ),
              };
              break;

            case 'stalled': {
              const stalledDate = new Date();
              stalledDate.setDate(stalledDate.getDate() - 7);
              issues = await client.issues({
                first: limit,
                filter: {
                  state: { type: { eq: 'started' } },
                  updatedAt: { lt: stalledDate },
                  ...teamFilter,
                  ...assigneeFilter,
                },
              });
              break;
            }

            case 'recent':
            default:
              issues = await client.issues({
                first: limit,
                filter: {
                  ...teamFilter,
                  ...assigneeFilter,
                },
              });
              break;
          }

          if (!issues.nodes.length) {
            return `No issues found for filter: ${filter}`;
          }

          const formattedIssues = await Promise.all(
            issues.nodes.map(async (issue, i) => {
              const state = await issue.state;
              const assignee = await issue.assignee;
              const priority = [
                'None',
                '🔴 Urgent',
                '🟠 High',
                '🟡 Medium',
                '🔵 Low',
              ][issue.priority];
              return `${i + 1}. **${issue.identifier}**: ${issue.title}
   Status: ${state?.name || 'Unknown'} | Priority: ${priority}
   Assignee: ${assignee?.name || 'Unassigned'}
   URL: ${issue.url}`;
            }),
          );

          return `## Linear Issues (${filter})\n\n${formattedIssues.join('\n\n')}`;
        } catch (error) {
          logger.error('Failed to get Linear issues', error);
          return `Error fetching issues: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'get_linear_issues',
        description: `Get issues from Linear. Use this to see:
- my_issues: Issues assigned to the current user
- team_issues: All issues for a team
- blockers: Issues marked as blocked
- stalled: Issues with no recent updates (7+ days)
- recent: Recently updated issues
Supports optional assignee filtering via assignee (name/email) or assigneeId.`,
        schema: GetLinearIssuesSchema,
      },
    );
  }

  /**
   * Get detailed information about a specific Linear issue
   */
  private createGetLinearIssueDetailsTool(): StructuredToolInterface {
    const getClient = this.getLinearClient.bind(this);
    const logger = this.logger;

    return tool(
      async ({ issueId }, config) => {
        const workspaceId = getWorkspaceId(config);
        const client = await getClient(workspaceId);

        if (!client) {
          return '❌ Linear integration not connected.';
        }

        try {
          const issue = await client.issue(issueId);

          if (!issue) {
            return `Issue ${issueId} not found.`;
          }

          const state = await issue.state;
          const assignee = await issue.assignee;
          const project = await issue.project;
          const cycle = await issue.cycle;
          const labels = await issue.labels();
          const comments = await issue.comments({ first: 5 });
          const children = await issue.children({ first: 10 });

          const labelNames =
            labels.nodes.map((l) => l.name).join(', ') || 'None';
          const priority = [
            'None',
            '🔴 Urgent',
            '🟠 High',
            '🟡 Medium',
            '🔵 Low',
          ][issue.priority];

          let details = `## ${issue.identifier}: ${issue.title}

**Status**: ${state?.name || 'Unknown'}
**Priority**: ${priority}
**Assignee**: ${assignee?.name || 'Unassigned'}
**Labels**: ${labelNames}
**Project**: ${project?.name || 'None'}
**Cycle**: ${cycle?.name || 'None'}
**Estimate**: ${issue.estimate || 'Not estimated'}
**Created**: ${issue.createdAt.toLocaleDateString()}
**Updated**: ${issue.updatedAt.toLocaleDateString()}
**URL**: ${issue.url}

### Description
${issue.description || 'No description'}`;

          if (children.nodes.length > 0) {
            details += `\n\n### Sub-issues (${children.nodes.length})`;
            for (const child of children.nodes) {
              const childState = await child.state;
              details += `\n- ${child.identifier}: ${child.title} (${childState?.name || 'Unknown'})`;
            }
          }

          if (comments.nodes.length > 0) {
            details += `\n\n### Recent Comments`;
            for (const comment of comments.nodes) {
              const user = await comment.user;
              details += `\n\n**${user?.name || 'Unknown'}** (${comment.createdAt.toLocaleDateString()}):\n${comment.body.slice(0, 200)}${comment.body.length > 200 ? '...' : ''}`;
            }
          }

          return details;
        } catch (error) {
          logger.error('Failed to get issue details', error);
          return `Error fetching issue: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'get_linear_issue_details',
        description:
          'Get detailed information about a specific Linear issue including description, comments, and sub-issues.',
        schema: GetLinearIssueDetailsSchema,
      },
    );
  }

  /**
   * Search Linear issues by query
   */
  private createSearchLinearIssuesTool(): StructuredToolInterface {
    const getClient = this.getLinearClient.bind(this);
    const logger = this.logger;

    return tool(
      async ({ query, includeArchived, limit }, config) => {
        const workspaceId = getWorkspaceId(config);
        const client = await getClient(workspaceId);

        if (!client) {
          return '❌ Linear integration not connected.';
        }

        try {
          const results = await client.searchIssues(query, {
            includeArchived,
          });

          if (!results.nodes.length) {
            return `No issues found matching "${query}"`;
          }

          const formattedResults = await Promise.all(
            results.nodes.slice(0, limit).map(async (issue, i) => {
              const state = await issue.state;
              return `${i + 1}. **${issue.identifier}**: ${issue.title}
   Status: ${state?.name || 'Unknown'}
   URL: ${issue.url}`;
            }),
          );

          return `## Search Results for "${query}"\n\n${formattedResults.join('\n\n')}`;
        } catch (error) {
          logger.error('Failed to search issues', error);
          return `Error searching: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'search_linear_issues',
        description:
          'Search for Linear issues by text query. Searches titles, descriptions, and comments.',
        schema: SearchLinearIssuesSchema,
      },
    );
  }

  /**
   * Get Linear project status
   */
  private createGetLinearProjectStatusTool(): StructuredToolInterface {
    const getClient = this.getLinearClient.bind(this);
    const logger = this.logger;

    return tool(
      async ({ projectId, includeCompleted }, config) => {
        const workspaceId = getWorkspaceId(config);
        const client = await getClient(workspaceId);

        if (!client) {
          return '❌ Linear integration not connected.';
        }

        try {
          let projects;
          if (projectId) {
            const project = await client.project(projectId);
            projects = { nodes: project ? [project] : [] };
          } else {
            projects = await client.projects({
              first: 10,
              filter: includeCompleted
                ? {}
                : { state: { nin: ['completed', 'canceled'] } },
            });
          }

          if (!projects.nodes.length) {
            return 'No projects found.';
          }

          const formattedProjects = await Promise.all(
            projects.nodes.map(async (project) => {
              const milestones = await project.projectMilestones({ first: 5 });
              const issues = await project.issues({ first: 100 });

              const totalIssues = issues.nodes.length;
              let completedIssues = 0;
              for (const issue of issues.nodes) {
                const state = await issue.state;
                if (state?.type === 'completed') completedIssues++;
              }

              const progress =
                totalIssues > 0
                  ? Math.round((completedIssues / totalIssues) * 100)
                  : 0;

              const lead = await project.lead;

              let result = `### ${project.name}
**Progress**: ${progress}% (${completedIssues}/${totalIssues} issues)
**Status**: ${project.state}
**Lead**: ${lead?.name || 'None'}
**Target**: ${project.targetDate?.toLocaleDateString() || 'Not set'}`;

              if (milestones.nodes.length > 0) {
                result += '\n\n**Milestones**:';
                for (const milestone of milestones.nodes) {
                  result += `\n- ${milestone.name}: ${milestone.targetDate?.toLocaleDateString() || 'No date'}`;
                }
              }

              return result;
            }),
          );

          return `## Project Status\n\n${formattedProjects.join('\n\n---\n\n')}`;
        } catch (error) {
          logger.error('Failed to get project status', error);
          return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'get_linear_project_status',
        description:
          'Get status of Linear projects including progress, milestones, and deadlines.',
        schema: GetLinearProjectStatusSchema,
      },
    );
  }

  /**
   * Get team workload distribution
   */
  private createGetLinearTeamWorkloadTool(): StructuredToolInterface {
    const getClient = this.getLinearClient.bind(this);
    const logger = this.logger;

    return tool(
      async ({ teamId, includeUnassigned }, config) => {
        const workspaceId = getWorkspaceId(config);
        const client = await getClient(workspaceId);

        if (!client) {
          return '❌ Linear integration not connected.';
        }

        try {
          const viewer = await client.viewer;
          let team;

          if (teamId) {
            team = await client.team(teamId);
          } else {
            const teams = await viewer.teams();
            team = teams.nodes[0];
          }

          if (!team) {
            return 'No team found.';
          }

          const members = await team.members();
          const issues = await team.issues({
            first: 200,
            filter: { state: { type: { nin: ['completed', 'canceled'] } } },
          });

          // Build workload map
          const workload: Map<
            string,
            { name: string; issues: number; points: number; urgent: number }
          > = new Map();

          // Initialize with team members
          for (const member of members.nodes) {
            workload.set(member.id, {
              name: member.name,
              issues: 0,
              points: 0,
              urgent: 0,
            });
          }

          // Count unassigned
          let unassignedCount = 0;
          let unassignedPoints = 0;

          for (const issue of issues.nodes) {
            const assignee = await issue.assignee;
            if (assignee) {
              const current = workload.get(assignee.id) || {
                name: assignee.name,
                issues: 0,
                points: 0,
                urgent: 0,
              };
              current.issues++;
              current.points += issue.estimate || 0;
              if (issue.priority === 1) current.urgent++;
              workload.set(assignee.id, current);
            } else {
              unassignedCount++;
              unassignedPoints += issue.estimate || 0;
            }
          }

          let result = `## Team Workload: ${team.name}\n\n`;

          // Sort by issue count descending
          const sorted = Array.from(workload.values()).sort(
            (a, b) => b.issues - a.issues,
          );

          for (const member of sorted) {
            if (member.issues === 0) continue;
            const urgentBadge =
              member.urgent > 0 ? ` (🔴 ${member.urgent} urgent)` : '';
            result += `**${member.name}**: ${member.issues} issues, ${member.points} points${urgentBadge}\n`;
          }

          if (includeUnassigned && unassignedCount > 0) {
            result += `\n**Unassigned**: ${unassignedCount} issues, ${unassignedPoints} points`;
          }

          return result;
        } catch (error) {
          logger.error('Failed to get workload', error);
          return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'get_linear_team_workload',
        description:
          'Get workload distribution across team members showing issues and points assigned to each person.',
        schema: GetLinearTeamWorkloadSchema,
      },
    );
  }

  /**
   * Get cycle status
   */
  private createGetLinearCycleStatusTool(): StructuredToolInterface {
    const getClient = this.getLinearClient.bind(this);
    const logger = this.logger;

    return tool(
      async ({ cycleId, teamId }, config) => {
        const workspaceId = getWorkspaceId(config);
        const client = await getClient(workspaceId);

        if (!client) {
          return '❌ Linear integration not connected.';
        }

        try {
          let cycle;

          if (cycleId) {
            cycle = await client.cycle(cycleId);
          } else {
            // Get active cycle for team
            const viewer = await client.viewer;
            let team;

            if (teamId) {
              team = await client.team(teamId);
            } else {
              const teams = await viewer.teams();
              team = teams.nodes[0];
            }

            if (!team) {
              return 'No team found.';
            }

            const cycles = await team.cycles({
              first: 1,
              filter: { isActive: { eq: true } },
            });

            cycle = cycles.nodes[0];
          }

          if (!cycle) {
            return 'No active cycle found.';
          }

          const issues = await cycle.issues({ first: 100 });
          const scopedIssues = await cycle.uncompletedIssuesUponClose({
            first: 100,
          });

          let completed = 0;
          let inProgress = 0;
          let todo = 0;
          let totalPoints = 0;
          let completedPoints = 0;

          for (const issue of issues.nodes) {
            const state = await issue.state;
            totalPoints += issue.estimate || 0;

            if (state?.type === 'completed') {
              completed++;
              completedPoints += issue.estimate || 0;
            } else if (state?.type === 'started') {
              inProgress++;
            } else {
              todo++;
            }
          }

          const progress =
            issues.nodes.length > 0
              ? Math.round((completed / issues.nodes.length) * 100)
              : 0;

          const daysRemaining = cycle.endsAt
            ? Math.ceil(
                (cycle.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              )
            : 'Unknown';

          return `## Cycle: ${cycle.name || `Cycle ${cycle.number}`}

**Progress**: ${progress}% complete
**Timeline**: ${cycle.startsAt?.toLocaleDateString() || 'N/A'} → ${cycle.endsAt?.toLocaleDateString() || 'N/A'}
**Days Remaining**: ${daysRemaining}

### Issues
- ✅ Completed: ${completed}
- 🔄 In Progress: ${inProgress}
- 📋 Todo: ${todo}
- **Total**: ${issues.nodes.length}

### Points
- Completed: ${completedPoints}/${totalPoints} (${totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0}%)

${scopedIssues.nodes.length > 0 ? `\n⚠️ **${scopedIssues.nodes.length} issues** were not completed when this cycle closed.` : ''}`;
        } catch (error) {
          logger.error('Failed to get cycle status', error);
          return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'get_linear_cycle_status',
        description:
          'Get status of the current sprint/cycle including progress, issues breakdown, and timeline.',
        schema: GetLinearCycleStatusSchema,
      },
    );
  }

  /**
   * Add a comment to a Linear issue
   */
  private createAddLinearCommentTool(): StructuredToolInterface {
    const getClient = this.getLinearClient.bind(this);
    const logger = this.logger;

    return tool(
      async ({ issueId, body }, config) => {
        const workspaceId = getWorkspaceId(config);
        const client = await getClient(workspaceId);

        if (!client) {
          return '❌ Linear integration not connected.';
        }

        try {
          const result = await client.createComment({
            issueId,
            body,
          });

          if (result.success) {
            return `✅ Comment added to issue.\n\nPreview:\n"${body.slice(0, 200)}${body.length > 200 ? '...' : ''}"`;
          } else {
            return '❌ Failed to add comment.';
          }
        } catch (error) {
          logger.error('Failed to add comment', error);
          return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'add_linear_comment',
        description:
          'Add a comment to a Linear issue. Use this to provide updates, ask questions, or document decisions.',
        schema: AddLinearCommentSchema,
      },
    );
  }

  private createCreateLinearIssueTool(): StructuredToolInterface {
    const getClient = this.getLinearClient.bind(this);
    const logger = this.logger;

    return tool(
      async (
        {
          title,
          description,
          teamId,
          projectId,
          assigneeId,
          priority,
          labelIds,
        },
        config,
      ) => {
        const workspaceId = getWorkspaceId(config);
        const client = await getClient(workspaceId);

        if (!client) {
          return '❌ Linear integration not connected. Please connect Linear in Settings > Integrations.';
        }

        try {
          const viewer = await client.viewer;
          const teamsResponse = await viewer.teams();
          const teams = teamsResponse.nodes ?? [];
          if (!teams.length) {
            return 'No teams found in Linear. Provide a teamId to create the issue.';
          }

          const normalizedTeamInput = teamId?.trim();
          const defaultTeam = teams[0] as TeamSummary;
          let resolvedTeam = defaultTeam;
          let teamNotice: string | undefined;

          if (normalizedTeamInput) {
            const lowerInput = normalizedTeamInput.toLowerCase();
            const exactMatch = teams.find(
              (team) => team.id === normalizedTeamInput,
            );
            const keyMatch = teams.find(
              (team) => team.key?.toLowerCase() === lowerInput,
            );
            const nameMatch = teams.find(
              (team) => team.name?.toLowerCase() === lowerInput,
            );

            if (exactMatch || keyMatch || nameMatch) {
              resolvedTeam = (exactMatch || keyMatch || nameMatch) as TeamSummary;
              if (!exactMatch) {
                teamNotice = `Resolved team "${teamId}" to ${formatTeamLabel(resolvedTeam)}.`;
              }
            } else {
              const partialMatches = teams.filter((team) => {
                const name = team.name?.toLowerCase() ?? '';
                const key = team.key?.toLowerCase() ?? '';
                return name.includes(lowerInput) || key.includes(lowerInput);
              });

              if (partialMatches.length === 1) {
                resolvedTeam = partialMatches[0] as TeamSummary;
                teamNotice = `Resolved team "${teamId}" to ${formatTeamLabel(resolvedTeam)}.`;
              } else if (partialMatches.length > 1) {
                const matches = partialMatches
                  .map((team) => formatTeamLabel(team as TeamSummary))
                  .join(', ');
                return `Multiple teams match "${teamId}". Provide a team ID or key. Matches: ${matches}`;
              } else {
                const options = teams
                  .map((team) => formatTeamLabel(team as TeamSummary))
                  .join(', ');
                teamNotice = `Team "${teamId}" not found. Using default team ${formatTeamLabel(defaultTeam)}. Available teams: ${options}.`;
              }
            }
          }

          const response = await client.createIssue({
            title,
            description,
            teamId: resolvedTeam.id,
            projectId,
            assigneeId,
            priority,
            labelIds,
          });

          if (!response.success || !response.issue) {
            return 'Failed to create Linear issue.';
          }

          const issue = await response.issue;

          const payload: Record<string, unknown> = {
            success: true,
            action: 'create_linear_issue',
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url,
            teamId: issue.teamId,
            projectId: issue.projectId,
            assigneeId: issue.assigneeId,
            priority: issue.priority,
            resolvedTeam: {
              id: resolvedTeam.id,
              name: resolvedTeam.name,
              key: resolvedTeam.key,
            },
          };

          if (teamNotice) {
            payload.notice = teamNotice;
          }

          return JSON.stringify(payload, null, 2);
        } catch (error) {
          logger.error(
            { err: error, workspaceId, title },
            'Failed to create Linear issue',
          );
          return `Failed to create Linear issue: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'create_linear_issue',
        description:
          'Create a new Linear issue. Use this when the user asks to create or file a ticket.',
        schema: CreateLinearIssueSchema,
      },
    );
  }
}
