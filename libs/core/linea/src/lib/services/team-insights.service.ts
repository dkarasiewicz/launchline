import { Injectable, Logger } from '@nestjs/common';
import { MemoryService } from './memory.service';
import {
  IntegrationFacade,
  IntegrationType,
  GitHubService,
  LinearService,
} from '@launchline/core-integration';
import type { MemoryItem, MemoryNamespace } from '../types';
import type {
  LineaGraphEdge,
  LineaGraphNode,
  LineaGraphNodeMetrics,
  LineaTeamGraph,
  LineaTeamInsight,
} from '../linea-admin.models';

type NodeType =
  | 'person'
  | 'team'
  | 'project'
  | 'ticket'
  | 'pr'
  | 'decision'
  | 'other';

type NodeBuild = LineaGraphNode & {
  metrics?: LineaGraphNodeMetrics;
};

type GraphReferenceMaps = {
  userLabels: Map<string, string>;
  userNodes: Map<string, string>;
  ticketNodes: Map<string, string>;
  prNodes: Map<string, string>;
  projectNodes: Map<string, string>;
  teamNodes: Map<string, string>;
};

@Injectable()
export class TeamInsightsService {
  private readonly logger = new Logger(TeamInsightsService.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly integrationFacade: IntegrationFacade,
    private readonly linearService: LinearService,
    private readonly githubService: GitHubService,
  ) {}

  async buildTeamGraph(
    workspaceId: string,
    limit = 240,
  ): Promise<LineaTeamGraph> {
    const namespaces: MemoryNamespace[] = [
      'team',
      'user',
      'project',
      'ticket',
      'pr',
      'blocker',
      'decision',
      'standup',
      'meeting',
      'discussion',
      'slack_thread',
      'pattern',
    ];

    const perNamespace = Math.max(12, Math.floor(limit / namespaces.length));
    const batches = await Promise.all(
      namespaces.map((ns) =>
        this.memoryService.listMemories(workspaceId, ns, {
          limit: perNamespace,
        }),
      ),
    );
    const memories = batches.flat();

    const nodeMap = new Map<string, NodeBuild>();
    const edgeMap = new Map<string, LineaGraphEdge>();
    const referenceMaps: GraphReferenceMaps = {
      userLabels: new Map<string, string>(),
      userNodes: new Map<string, string>(),
      ticketNodes: new Map<string, string>(),
      prNodes: new Map<string, string>(),
      projectNodes: new Map<string, string>(),
      teamNodes: new Map<string, string>(),
    };

    await this.addLinearSnapshot(
      workspaceId,
      limit,
      nodeMap,
      edgeMap,
      referenceMaps,
    );

    await this.addGitHubSnapshot(
      workspaceId,
      nodeMap,
      edgeMap,
      referenceMaps,
    );

    for (const memory of memories) {
      if (memory.namespace === 'team') {
        const identity = this.parseIdentity(memory);
        if (identity?.id) {
          const accountKeys = [
            identity.accounts?.linearId,
            identity.accounts?.slackId
              ? `slack:${identity.accounts.slackId}`
              : undefined,
            identity.accounts?.githubLogin
              ? `github:${identity.accounts.githubLogin}`
              : undefined,
          ].filter(Boolean) as string[];

          const existingNodeId =
            accountKeys
              .map((key) => referenceMaps.userNodes.get(key))
              .find(Boolean) ||
            referenceMaps.userNodes.get(identity.id) ||
            undefined;

          const nodeId = existingNodeId || this.userNodeId(identity.id);
          const label = identity.displayName || this.shortLabel(identity.id);

          referenceMaps.userLabels.set(identity.id, label);
          referenceMaps.userNodes.set(identity.id, nodeId);

          accountKeys.forEach((key) => {
            referenceMaps.userLabels.set(key, label);
            referenceMaps.userNodes.set(key, nodeId);
          });

          this.ensureNode(nodeMap, {
            id: nodeId,
            label,
            type: 'person',
          });
        }
      }
    }

    for (const memory of memories) {
      this.applyMemoryToGraph(memory, nodeMap, edgeMap, referenceMaps);
    }

    const nodes = Array.from(nodeMap.values()).map((node) => ({
      ...node,
      metrics: node.metrics,
    }));

    const edges = Array.from(edgeMap.values());
    const insights = this.buildInsights(nodes, edges);

    return { nodes, edges, insights };
  }

  summarizeTeam(
    graph: LineaTeamGraph,
    focus?: string,
  ): string {
    const people = graph.nodes.filter((node) => node.type === 'person');
    if (people.length === 0) {
      return 'No team profile data yet. Connect integrations to build a collaboration map.';
    }

    const focusNode = focus
      ? people.find((node) =>
          node.label.toLowerCase().includes(focus.toLowerCase()),
        )
      : undefined;

    if (focusNode) {
      const metrics = focusNode.metrics;
      const lines = [
        `Team view for ${focusNode.label}:`,
        metrics?.connections
          ? `- Connected to ${metrics.connections} work signals`
          : null,
        metrics?.blockers
          ? `- Involved in ${metrics.blockers} blocker signals`
          : null,
        metrics?.decisions
          ? `- Mentioned in ${metrics.decisions} decisions`
          : null,
        metrics?.tickets
          ? `- Linked to ${metrics.tickets} tickets`
          : null,
        metrics?.prs ? `- Linked to ${metrics.prs} PRs` : null,
        metrics?.projects
          ? `- Linked to ${metrics.projects} projects`
          : null,
      ].filter(Boolean) as string[];

      return lines.join('\n');
    }

    const topConnectors = [...people]
      .sort(
        (a, b) => (b.metrics?.connections || 0) - (a.metrics?.connections || 0),
      )
      .slice(0, 3);

    const lines = [
      `Team map summary (${people.length} people, ${graph.edges.length} connections):`,
      topConnectors.length
        ? `Top connectors: ${topConnectors
            .map((p) => p.label)
            .join(', ')}.`
        : null,
      ...graph.insights.map((insight) => `- ${insight.title}: ${insight.detail}`),
    ].filter(Boolean) as string[];

    return lines.join('\n');
  }

  private applyMemoryToGraph(
    memory: MemoryItem,
    nodeMap: Map<string, NodeBuild>,
    edgeMap: Map<string, LineaGraphEdge>,
    referenceMaps: GraphReferenceMaps,
  ) {
    const userIds = memory.entityRefs?.userIds ?? [];
    const ticketIds = memory.entityRefs?.ticketIds ?? [];
    const prIds = memory.entityRefs?.prIds ?? [];
    const projectIds = memory.entityRefs?.projectIds ?? [];
    const teamIds = memory.entityRefs?.teamIds ?? [];

    if (
      userIds.length === 0 &&
      ticketIds.length === 0 &&
      prIds.length === 0 &&
      projectIds.length === 0 &&
      teamIds.length === 0
    ) {
      return;
    }

    const userNodeIds = userIds.map((id) => {
      const existingNodeId = referenceMaps.userNodes.get(id);
      const label =
        referenceMaps.userLabels.get(id) || this.shortLabel(id);
      const nodeId = existingNodeId || this.userNodeId(id);
      this.ensureNode(nodeMap, {
        id: nodeId,
        label,
        type: 'person',
      });
      referenceMaps.userNodes.set(id, nodeId);
      this.bumpMetric(nodeMap, nodeId, 'connections', 0);
      this.bumpMetric(nodeMap, nodeId, 'tickets', 0);
      this.bumpMetric(nodeMap, nodeId, 'prs', 0);
      this.bumpMetric(nodeMap, nodeId, 'projects', 0);
      this.bumpMetric(nodeMap, nodeId, 'blockers', 0);
      this.bumpMetric(nodeMap, nodeId, 'decisions', 0);
      return nodeId;
    });

    const ticketNodeIds = ticketIds.map((id) =>
      this.resolveEntityNode(
        nodeMap,
        referenceMaps.ticketNodes,
        'ticket',
        id,
        id,
      ),
    );
    const prNodeIds = prIds.map((id) =>
      this.resolveEntityNode(
        nodeMap,
        referenceMaps.prNodes,
        'pr',
        id,
        `PR ${id}`,
      ),
    );
    const projectNodeIds = projectIds.map((id) =>
      this.resolveEntityNode(
        nodeMap,
        referenceMaps.projectNodes,
        'project',
        id,
        id,
      ),
    );
    const teamNodeIds = teamIds.map((id) =>
      this.resolveEntityNode(
        nodeMap,
        referenceMaps.teamNodes,
        'team',
        id,
        `Team ${id}`,
      ),
    );

    const edgeType = memory.category || 'link';

    for (const userNodeId of userNodeIds) {
      if (memory.category === 'blocker') {
        this.bumpMetric(nodeMap, userNodeId, 'blockers', 1);
      }
      if (memory.category === 'decision') {
        this.bumpMetric(nodeMap, userNodeId, 'decisions', 1);
      }

      for (const ticketNodeId of ticketNodeIds) {
        this.bumpMetric(nodeMap, userNodeId, 'tickets', 1);
        this.addEdge(nodeMap, edgeMap, userNodeId, ticketNodeId, edgeType);
      }
      for (const prNodeId of prNodeIds) {
        this.bumpMetric(nodeMap, userNodeId, 'prs', 1);
        this.addEdge(nodeMap, edgeMap, userNodeId, prNodeId, edgeType);
      }
      for (const projectNodeId of projectNodeIds) {
        this.bumpMetric(nodeMap, userNodeId, 'projects', 1);
        this.addEdge(nodeMap, edgeMap, userNodeId, projectNodeId, edgeType);
      }
      for (const teamNodeId of teamNodeIds) {
        this.addEdge(nodeMap, edgeMap, userNodeId, teamNodeId, 'team');
      }
    }

    if (
      userNodeIds.length > 1 &&
      ticketNodeIds.length === 0 &&
      prNodeIds.length === 0 &&
      projectNodeIds.length === 0
    ) {
      for (let i = 0; i < userNodeIds.length; i += 1) {
        for (let j = i + 1; j < userNodeIds.length; j += 1) {
          this.addEdge(
            nodeMap,
            edgeMap,
            userNodeIds[i],
            userNodeIds[j],
            'collaboration',
          );
        }
      }
    }
  }

  private buildInsights(
    nodes: LineaGraphNode[],
    edges: LineaGraphEdge[],
  ): LineaTeamInsight[] {
    const insights: LineaTeamInsight[] = [];
    const people = nodes.filter((node) => node.type === 'person');

    if (people.length === 0) {
      return insights;
    }

    const sortedByConnections = [...people].sort(
      (a, b) => (b.metrics?.connections || 0) - (a.metrics?.connections || 0),
    );
    const hub = sortedByConnections[0];

    if (hub) {
      insights.push({
        title: 'Collaboration hub',
        detail: `${hub.label} is connected to ${hub.metrics?.connections || 0} work signals.`,
        level: 'info',
      });
    }

    const blockerHeavy = [...people].sort(
      (a, b) => (b.metrics?.blockers || 0) - (a.metrics?.blockers || 0),
    )[0];

    if (blockerHeavy?.metrics?.blockers) {
      insights.push({
        title: 'Blocker hotspot',
        detail: `${blockerHeavy.label} appears in ${blockerHeavy.metrics.blockers} blocker-related signals.`,
        level: 'warning',
      });
    }

    const lowConnected = people.filter(
      (person) => (person.metrics?.connections || 0) <= 1,
    );
    if (lowConnected.length > 0) {
      insights.push({
        title: 'Potential silos',
        detail: `${lowConnected.length} teammate${lowConnected.length > 1 ? 's' : ''} have low visible collaboration signals.`,
        level: 'neutral',
      });
    }

    if (edges.length === 0) {
      insights.push({
        title: 'Connect more signals',
        detail: 'No strong cross-tool connections yet. Connect Slack + Linear for a richer map.',
        level: 'neutral',
      });
    }

    return insights;
  }

  private resolveEntityNode(
    nodeMap: Map<string, NodeBuild>,
    lookup: Map<string, string>,
    type: NodeType,
    id: string,
    label: string,
  ): string {
    const existing = lookup.get(id);
    if (existing) {
      return existing;
    }

    const nodeId = `${type}:${id}`;
    lookup.set(id, nodeId);
    this.ensureNode(nodeMap, {
      id: nodeId,
      label,
      type,
    });
    return nodeId;
  }

  private async addLinearSnapshot(
    workspaceId: string,
    limit: number,
    nodeMap: Map<string, NodeBuild>,
    edgeMap: Map<string, LineaGraphEdge>,
    referenceMaps: GraphReferenceMaps,
  ): Promise<void> {
    try {
      const integrations = await this.integrationFacade.getIntegrationsByType(
        workspaceId,
        IntegrationType.LINEAR,
      );
      const integrationId = integrations[0]?.id;
      if (!integrationId) {
        return;
      }

      const token = await this.integrationFacade.getAccessToken(integrationId);
      if (!token) {
        return;
      }

      const client = this.linearService.createClient(token);

      const maxUsers = Math.min(Math.max(12, Math.floor(limit * 0.25)), 80);
      const maxTeams = Math.min(Math.max(6, Math.floor(limit * 0.1)), 40);
      const maxProjects = Math.min(Math.max(10, Math.floor(limit * 0.2)), 60);
      const maxIssues = Math.min(Math.max(20, Math.floor(limit * 0.5)), 120);

      const [users, teams, projects, issues] = await Promise.all([
        client.users({ first: maxUsers }),
        client.teams({ first: maxTeams }),
        client.projects({ first: maxProjects }),
        client.issues({
          first: maxIssues,
          filter: { state: { type: { nin: ['completed', 'canceled'] } } },
        }),
      ]);

      users.nodes.forEach((user) => {
        const nodeId = this.userNodeId(user.id);
        referenceMaps.userLabels.set(user.id, user.name);
        referenceMaps.userNodes.set(user.id, nodeId);
        if (user.email) {
          referenceMaps.userLabels.set(user.email, user.name);
          referenceMaps.userNodes.set(user.email, nodeId);
        }
        this.ensureNode(nodeMap, {
          id: nodeId,
          label: user.name,
          type: 'person',
        });
      });

      teams.nodes.forEach((team) => {
        const nodeId = `team:${team.id}`;
        referenceMaps.teamNodes.set(team.id, nodeId);
        if (team.name) {
          referenceMaps.teamNodes.set(team.name, nodeId);
        }
        this.ensureNode(nodeMap, {
          id: nodeId,
          label: team.name || this.shortLabel(team.id),
          type: 'team',
        });
      });

      projects.nodes.forEach((project) => {
        const nodeId = `project:${project.id}`;
        referenceMaps.projectNodes.set(project.id, nodeId);
        if (project.name) {
          referenceMaps.projectNodes.set(project.name, nodeId);
        }
        this.ensureNode(nodeMap, {
          id: nodeId,
          label: project.name || this.shortLabel(project.id),
          type: 'project',
        });
      });

      for (const issue of issues.nodes) {
        const ticketNodeId = `ticket:${issue.identifier}`;
        referenceMaps.ticketNodes.set(issue.identifier, ticketNodeId);
        referenceMaps.ticketNodes.set(issue.id, ticketNodeId);

        this.ensureNode(nodeMap, {
          id: ticketNodeId,
          label: `${issue.identifier}: ${issue.title}`,
          type: 'ticket',
        });

        const [assignee, team, project] = await Promise.all([
          issue.assignee,
          issue.team,
          issue.project,
        ]);

        if (assignee) {
          const userNodeId =
            referenceMaps.userNodes.get(assignee.id) ||
            this.userNodeId(assignee.id);
          this.ensureNode(nodeMap, {
            id: userNodeId,
            label: assignee.name,
            type: 'person',
          });
          referenceMaps.userLabels.set(assignee.id, assignee.name);
          referenceMaps.userNodes.set(assignee.id, userNodeId);
          this.addEdge(
            nodeMap,
            edgeMap,
            userNodeId,
            ticketNodeId,
            'assignment',
          );
          this.bumpMetric(nodeMap, userNodeId, 'tickets', 1);
        }

        if (project) {
          const projectNodeId =
            referenceMaps.projectNodes.get(project.id) ||
            `project:${project.id}`;
          this.ensureNode(nodeMap, {
            id: projectNodeId,
            label: project.name || this.shortLabel(project.id),
            type: 'project',
          });
          referenceMaps.projectNodes.set(project.id, projectNodeId);
          this.addEdge(
            nodeMap,
            edgeMap,
            ticketNodeId,
            projectNodeId,
            'project',
          );
          if (assignee) {
            const userNodeId =
              referenceMaps.userNodes.get(assignee.id) ||
              this.userNodeId(assignee.id);
            this.bumpMetric(nodeMap, userNodeId, 'projects', 1);
          }
        }

        if (team) {
          const teamNodeId =
            referenceMaps.teamNodes.get(team.id) || `team:${team.id}`;
          this.ensureNode(nodeMap, {
            id: teamNodeId,
            label: team.name || this.shortLabel(team.id),
            type: 'team',
          });
          referenceMaps.teamNodes.set(team.id, teamNodeId);
          this.addEdge(nodeMap, edgeMap, ticketNodeId, teamNodeId, 'team');
        }
      }
    } catch (error) {
      this.logger.error(
        { err: error, workspaceId },
        'Failed to load Linear snapshot for team graph',
      );
    }
  }

  private async addGitHubSnapshot(
    workspaceId: string,
    nodeMap: Map<string, NodeBuild>,
    edgeMap: Map<string, LineaGraphEdge>,
    referenceMaps: GraphReferenceMaps,
  ): Promise<void> {
    try {
      const integrations = await this.integrationFacade.getIntegrationsByType(
        workspaceId,
        IntegrationType.GITHUB,
      );
      const integrationId = integrations[0]?.id;
      if (!integrationId) {
        return;
      }

      const token = await this.integrationFacade.getAccessToken(integrationId);
      if (!token) {
        return;
      }

      const repos = await this.githubService.listRepositories(token, {
        limit: 8,
      });

      for (const repo of repos) {
        const repoNodeId = `repo:${repo.fullName}`;
        this.ensureNode(nodeMap, {
          id: repoNodeId,
          label: repo.fullName,
          type: 'project',
        });

        referenceMaps.projectNodes.set(repo.fullName, repoNodeId);

        const contributors = await this.githubService.listRepoContributors(
          token,
          repo.owner,
          repo.name,
          8,
        );

        for (const contributor of contributors) {
          const userKey = `github:${contributor.login}`;
          const userNodeId =
            referenceMaps.userNodes.get(userKey) || this.userNodeId(userKey);
          referenceMaps.userLabels.set(userKey, contributor.login);
          referenceMaps.userNodes.set(userKey, userNodeId);
          this.ensureNode(nodeMap, {
            id: userNodeId,
            label: contributor.login,
            type: 'person',
          });

          this.addEdge(
            nodeMap,
            edgeMap,
            userNodeId,
            repoNodeId,
            'contributes',
          );
        }

        const prs = await this.githubService.listRepoPullRequests(
          token,
          repo.owner,
          repo.name,
          { state: 'open', limit: 6 },
        );

        for (const pr of prs) {
          const prNodeId = `gh-pr:${repo.fullName}:${pr.number}`;
          referenceMaps.prNodes.set(prNodeId, prNodeId);
          this.ensureNode(nodeMap, {
            id: prNodeId,
            label: `${repo.name}#${pr.number}: ${pr.title}`,
            type: 'pr',
          });

          this.addEdge(nodeMap, edgeMap, repoNodeId, prNodeId, 'repo_pr');

          if (pr.author) {
            const userKey = `github:${pr.author}`;
            const userNodeId =
              referenceMaps.userNodes.get(userKey) || this.userNodeId(userKey);
            this.ensureNode(nodeMap, {
              id: userNodeId,
              label: pr.author,
              type: 'person',
            });
            referenceMaps.userNodes.set(userKey, userNodeId);
            referenceMaps.userLabels.set(userKey, pr.author);
            this.addEdge(nodeMap, edgeMap, userNodeId, prNodeId, 'author');
            this.bumpMetric(nodeMap, userNodeId, 'prs', 1);
          }
        }
      }
    } catch (error) {
      this.logger.error(
        { err: error, workspaceId },
        'Failed to load GitHub snapshot for team graph',
      );
    }
  }

  private ensureNode(
    nodeMap: Map<string, NodeBuild>,
    node: LineaGraphNode,
  ) {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, {
        ...node,
        metrics: {
          connections: 0,
        },
      });
    }
  }

  private addEdge(
    nodeMap: Map<string, NodeBuild>,
    edgeMap: Map<string, LineaGraphEdge>,
    source: string,
    target: string,
    type: string,
  ) {
    if (source === target) {
      return;
    }
    const key = [source, target, type].sort().join('|');
    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        source,
        target,
        type,
        weight: 1,
      });
      this.bumpMetric(nodeMap, source, 'connections', 1);
      this.bumpMetric(nodeMap, target, 'connections', 1);
    }
  }

  private bumpMetric(
    nodeMap: Map<string, NodeBuild>,
    nodeId: string,
    metric: keyof LineaGraphNodeMetrics,
    amount: number,
  ) {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    if (!node.metrics) {
      node.metrics = { connections: 0 };
    }
    node.metrics[metric] = (node.metrics[metric] || 0) + amount;
  }

  private userNodeId(userId: string) {
    return `user:${userId}`;
  }

  private shortLabel(value: string) {
    if (value.length <= 8) return value;
    return `${value.slice(0, 4)}…${value.slice(-3)}`;
  }

  private parseIdentity(
    memory: MemoryItem,
  ): {
    id: string;
    displayName: string;
    accounts?: {
      linearId?: string;
      slackId?: string;
      githubLogin?: string;
    };
  } | null {
    if (!memory.content || memory.content.length < 2) {
      return null;
    }

    if (!memory.content.trim().startsWith('{')) {
      return null;
    }

    try {
      const parsed = JSON.parse(memory.content) as {
        id?: string;
        displayName?: string;
        accounts?: {
          github?: { login?: string };
          linear?: { id?: string };
          slack?: { id?: string };
        };
      };
      if (parsed?.id && parsed?.displayName) {
        return {
          id: parsed.id,
          displayName: parsed.displayName,
          accounts: {
            linearId: parsed.accounts?.linear?.id,
            slackId: parsed.accounts?.slack?.id,
            githubLogin: parsed.accounts?.github?.login,
          },
        };
      }
    } catch (error) {
      this.logger.debug({ err: error }, 'Failed to parse identity memory');
    }

    return null;
  }
}
