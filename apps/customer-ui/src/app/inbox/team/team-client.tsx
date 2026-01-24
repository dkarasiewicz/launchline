'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { Button } from '@launchline/ui/components/ui/button';
import { LogoIcon } from '@launchline/ui/components/logo';
import { cn } from '@launchline/ui/lib/utils';
import {
  AlertTriangle,
  CircleDot,
  Inbox,
  Link2,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Pie, Bar } from '@visx/shape';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Text } from '@visx/text';
import { LinearGradient } from '@visx/gradient';

const TEAM_GRAPH_QUERY = gql`
  query LineaTeamGraph {
    lineaTeamGraph {
      nodes {
        id
        label
        type
        metrics {
          connections
          blockers
          decisions
          tickets
          prs
          projects
        }
      }
      edges {
        source
        target
        type
        weight
      }
      insights {
        title
        detail
        level
      }
    }
  }
`;

type GraphNode = {
  id: string;
  label: string;
  type: string;
  metrics?: {
    connections?: number;
    blockers?: number;
    decisions?: number;
    tickets?: number;
    prs?: number;
    projects?: number;
  };
};

type GraphEdge = {
  source: string;
  target: string;
  type: string;
  weight?: number;
};

type GraphInsight = {
  title: string;
  detail: string;
  level: string;
};

type TeamNodeData = {
  label: string;
  kind: string;
  metrics?: GraphNode['metrics'];
  selected?: boolean;
};

const nodeStyles: Record<
  string,
  { background: string; border: string; text: string }
> = {
  person: {
    background: 'bg-sky-500/10',
    border: 'border-sky-500/40',
    text: 'text-sky-200',
  },
  team: {
    background: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    text: 'text-emerald-200',
  },
  project: {
    background: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    text: 'text-amber-200',
  },
  ticket: {
    background: 'bg-indigo-500/10',
    border: 'border-indigo-500/40',
    text: 'text-indigo-200',
  },
  pr: {
    background: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/40',
    text: 'text-fuchsia-200',
  },
};

const edgeColors: Record<string, string> = {
  assignment: '#38bdf8',
  project: '#f59e0b',
  team: '#22c55e',
  blocker: '#ef4444',
  decision: '#eab308',
  collaboration: '#94a3b8',
};

const miniMapColors: Record<string, string> = {
  person: '#38bdf8',
  team: '#22c55e',
  project: '#f59e0b',
  ticket: '#6366f1',
  pr: '#d946ef',
  other: '#94a3b8',
};

function formatMetric(value?: number) {
  return typeof value === 'number' ? value : 0;
}

function TeamNode({ data }: NodeProps<TeamNodeData>) {
  const style = nodeStyles[data.kind] || {
    background: 'bg-muted/40',
    border: 'border-border/50',
    text: 'text-muted-foreground',
  };
  const sizeClass =
    data.kind === 'person' || data.kind === 'project'
      ? 'px-4 py-3 min-w-[150px]'
      : 'px-3 py-2 min-w-[130px]';
  const emphasisClass = data.selected
    ? 'ring-2 ring-primary/60 shadow-lg'
    : '';
  const connections = formatMetric(data.metrics?.connections);

  return (
    <div
      className={cn(
        'rounded-2xl border shadow-sm backdrop-blur-md max-w-[200px]',
        sizeClass,
        emphasisClass,
        style.background,
        style.border,
      )}
    >
      <p className={cn('text-[10px] uppercase tracking-widest', style.text)}>
        {data.kind}
      </p>
      <p className="text-sm font-semibold text-foreground truncate">
        {data.label}
      </p>
      {connections > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {connections} signal links
        </p>
      )}
    </div>
  );
}

function layoutColumn(
  items: GraphNode[],
  x: number,
  top: number,
  height: number,
  minGap = 52,
) {
  const count = Math.max(items.length, 1);
  const gap = Math.max(minGap, height / (count + 1));
  return items.map((item, index) => ({
    ...item,
    position: {
      x,
      y: top + gap * (index + 1),
    },
  }));
}

function TeamGraphFlow({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId?: string | null;
  onSelect?: (nodeId: string | null) => void;
}) {
  const { flowNodes, flowEdges } = useMemo(() => {
    const people = nodes.filter((node) => node.type === 'person');
    const initiatives = nodes.filter((node) =>
      ['project', 'team'].includes(node.type),
    );
    const work = nodes.filter((node) => ['ticket', 'pr'].includes(node.type));
    const other = nodes.filter(
      (node) =>
        !['person', 'project', 'team', 'ticket', 'pr'].includes(node.type),
    );

    const sortByConnections = (list: GraphNode[]) =>
      [...list].sort(
        (a, b) =>
          formatMetric(b.metrics?.connections) -
          formatMetric(a.metrics?.connections),
      );

    const visiblePeople = sortByConnections(people).slice(0, 12);
    const visibleInitiatives = sortByConnections(initiatives).slice(0, 10);
    const visibleWork = sortByConnections(work).slice(0, 10);
    const visibleOther = sortByConnections(other).slice(0, 6);

    const visibleNodes = [
      ...visiblePeople,
      ...visibleInitiatives,
      ...visibleWork,
      ...visibleOther,
    ];

    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    );

    const width = 980;
    const height = 520;
    const layout = [
      ...layoutColumn(visiblePeople, 120, 20, height - 40, 64),
      ...layoutColumn(visibleInitiatives, 380, 40, height - 80, 64),
      ...layoutColumn(visibleWork, 660, 20, height - 40, 52),
      ...layoutColumn(visibleOther, 880, 60, height - 120, 52),
    ];

    const flowNodes: Node<TeamNodeData>[] = layout.map((node) => ({
      id: node.id,
      type: 'teamNode',
      data: {
        label: node.label,
        kind: node.type,
        metrics: node.metrics,
        selected: node.id === selectedId,
      },
      position: node.position,
    }));

    const weightedEdges = [...visibleEdges].sort(
      (a, b) => (b.weight ?? 1) - (a.weight ?? 1),
    );
    const maxEdges = Math.max(36, visibleNodes.length * 2);
    const trimmedEdges = weightedEdges.slice(0, maxEdges);

    const flowEdges: Edge[] = trimmedEdges.map((edge) => {
      const weight = edge.weight ?? 1;
      const strokeWidth = Math.min(2.4, 0.8 + weight * 0.4);
      const opacity = Math.min(0.85, 0.35 + weight * 0.12);

      return {
        id: `${edge.source}-${edge.target}-${edge.type}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: edge.type === 'blocker',
        style: {
          stroke: edgeColors[edge.type] || 'rgba(148, 163, 184, 0.4)',
          strokeWidth,
          opacity,
        },
      };
    });

    return { flowNodes, flowEdges };
  }, [nodes, edges, selectedId]);

  if (!nodes.length) {
    return (
      <div className="flex h-[520px] items-center justify-center text-sm text-muted-foreground">
        Connect Slack + Linear to build a collaboration map.
      </div>
    );
  }

  return (
    <div className="h-[520px] rounded-2xl border border-border/50 bg-card/40">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={{ teamNode: TeamNode }}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => onSelect?.(node.id)}
        onPaneClick={() => onSelect?.(null)}
      >
        <Background gap={28} size={1} color="rgba(148, 163, 184, 0.2)" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const kind = (node.data as TeamNodeData)?.kind;
            return miniMapColors[kind] || miniMapColors.other;
          }}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function SignalMixChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const width = 320;
  const height = 220;
  const radius = Math.min(width, height) / 2 - 16;
  const innerRadius = radius * 0.62;

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Not enough signals yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <LinearGradient
          id="mix-gradient"
          from="#0f172a"
          to="#1f2937"
          vertical={false}
        />
        <rect width={width} height={height} fill="url(#mix-gradient)" rx={24} />
        <Group top={height / 2} left={width / 2}>
          <Pie
            data={data}
            pieValue={(item) => item.value}
            outerRadius={radius}
            innerRadius={innerRadius}
            padAngle={0.02}
          >
            {(pie) =>
              pie.arcs.map((arc) => (
                <g key={arc.data.label}>
                  <path d={pie.path(arc) || ''} fill={arc.data.color} />
                </g>
              ))
            }
          </Pie>
          <Text
            textAnchor="middle"
            verticalAnchor="middle"
            fill="#e2e8f0"
            fontSize={16}
            fontWeight={600}
          >
            Signal mix
          </Text>
        </Group>
      </svg>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: item.color }}
            />
            {item.label} · {item.value}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectorBarChart({ data }: { data: { label: string; value: number }[] }) {
  const width = 360;
  const height = 220;
  const margin = { top: 16, right: 16, bottom: 24, left: 90 };

  if (!data.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No teammate signals yet.
      </div>
    );
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const xScale = scaleLinear({
    domain: [0, maxValue],
    range: [0, width - margin.left - margin.right],
  });
  const yScale = scaleBand({
    domain: data.map((item) => item.label),
    range: [0, height - margin.top - margin.bottom],
    padding: 0.25,
  });

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <LinearGradient
        id="bars-gradient"
        from="#38bdf8"
        to="#22c55e"
        vertical={false}
      />
      <Group left={margin.left} top={margin.top}>
        {data.map((item) => {
          const barWidth = xScale(item.value) ?? 0;
          const barHeight = yScale.bandwidth();
          const y = yScale(item.label) ?? 0;

          return (
            <Group key={item.label}>
              <Bar
                x={0}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="url(#bars-gradient)"
                rx={6}
              />
              <Text
                x={-12}
                y={y + barHeight / 2}
                textAnchor="end"
                verticalAnchor="middle"
                fill="#cbd5f5"
                fontSize={11}
              >
                {item.label}
              </Text>
              <Text
                x={barWidth + 8}
                y={y + barHeight / 2}
                verticalAnchor="middle"
                fill="#94a3b8"
                fontSize={10}
              >
                {item.value}
              </Text>
            </Group>
          );
        })}
      </Group>
    </svg>
  );
}

export default function TeamClient() {
  const { data, loading, refetch, error } = useQuery<{
    lineaTeamGraph: {
      nodes: GraphNode[];
      edges: GraphEdge[];
      insights: GraphInsight[];
    };
  }>(TEAM_GRAPH_QUERY, {
    fetchPolicy: 'network-only',
  });

  const nodes = data?.lineaTeamGraph?.nodes ?? [];
  const edges = data?.lineaTeamGraph?.edges ?? [];
  const insights = data?.lineaTeamGraph?.insights ?? [];
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const people = useMemo(
    () => nodes.filter((node) => node.type === 'person'),
    [nodes],
  );

  const topConnectors = useMemo(
    () =>
      [...people]
        .sort(
          (a, b) =>
            formatMetric(b.metrics?.connections) -
            formatMetric(a.metrics?.connections),
        )
        .slice(0, 6),
    [people],
  );

  const signalMix = useMemo(() => {
    const totals = people.reduce(
      (acc, person) => {
        acc.tickets += formatMetric(person.metrics?.tickets);
        acc.prs += formatMetric(person.metrics?.prs);
        acc.projects += formatMetric(person.metrics?.projects);
        acc.blockers += formatMetric(person.metrics?.blockers);
        acc.decisions += formatMetric(person.metrics?.decisions);
        return acc;
      },
      {
        tickets: 0,
        prs: 0,
        projects: 0,
        blockers: 0,
        decisions: 0,
      },
    );

    return [
      { label: 'Tickets', value: totals.tickets, color: '#38bdf8' },
      { label: 'PRs', value: totals.prs, color: '#f97316' },
      { label: 'Projects', value: totals.projects, color: '#22c55e' },
      { label: 'Blockers', value: totals.blockers, color: '#ef4444' },
      { label: 'Decisions', value: totals.decisions, color: '#eab308' },
    ].filter((item) => item.value > 0);
  }, [people]);

  const connectorBars = useMemo(
    () =>
      topConnectors.map((person) => ({
        label: person.label,
        value: formatMetric(person.metrics?.connections),
      })),
    [topConnectors],
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const selectedConnections = useMemo(() => {
    if (!selectedNode) {
      return [];
    }

    const connectedEdges = edges.filter(
      (edge) => edge.source === selectedNode.id || edge.target === selectedNode.id,
    );

    return connectedEdges
      .map((edge) => {
        const counterpartId =
          edge.source === selectedNode.id ? edge.target : edge.source;
        const counterpart = nodes.find((node) => node.id === counterpartId);
        return {
          id: counterpartId,
          label: counterpart?.label || counterpartId,
          type: counterpart?.type || 'other',
          weight: edge.weight ?? 1,
          relation: edge.type,
        };
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }, [edges, nodes, selectedNode]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-14 border-r border-border/50 flex flex-col items-center py-4 gap-2 bg-card/30 flex-shrink-0">
        <Link href="/" className="mb-3">
          <LogoIcon className="w-6 h-6 text-foreground" />
        </Link>
        <Link href="/inbox">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg h-9 w-9"
          >
            <Inbox className="w-4 h-4" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary bg-primary/10 rounded-lg h-9 w-9"
        >
          <Users className="w-4 h-4" />
        </Button>
        <div className="flex-1" />
        <Link href="/inbox/settings?tab=data">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg h-9 w-9"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
      </aside>

      <main className="flex-1 px-8 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Team map
              </p>
              <h1 className="text-2xl font-semibold text-foreground">
                Collaboration graph
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                Linear anchors the ground truth. Slack, decisions, and
                standups layer the human context on top of the work graph.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Refresh map
            </Button>
          </header>

          <div className="grid gap-6 xl:grid-cols-[2.2fr,1fr]">
            <div className="rounded-2xl border border-border/50 bg-card/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Link2 className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-widest">
                    Network view
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {nodes.length} nodes • {edges.length} links
                </span>
              </div>
              {loading ? (
                <div className="flex h-[520px] items-center justify-center text-sm text-muted-foreground">
                  Building collaboration map...
                </div>
              ) : error ? (
                <div className="flex h-[520px] items-center justify-center text-sm text-destructive">
                  Failed to load collaboration map. Refresh to try again.
                </div>
              ) : (
                <TeamGraphFlow
                  nodes={nodes}
                  edges={edges}
                  selectedId={selectedNodeId}
                  onSelect={setSelectedNodeId}
                />
              )}
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-widest">
                    Selected node
                  </span>
                </div>
                {selectedNode && (
                  <span className="text-xs text-muted-foreground capitalize">
                    {selectedNode.type}
                  </span>
                )}
              </div>
              {!selectedNode ? (
                <p className="text-sm text-muted-foreground">
                  Click a node to inspect signals, dependencies, and ownership.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedNode.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMetric(selectedNode.metrics?.connections)} signal
                      links • {formatMetric(selectedNode.metrics?.tickets)} tickets •{' '}
                      {formatMetric(selectedNode.metrics?.prs)} PRs
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Projects: {formatMetric(selectedNode.metrics?.projects)}</span>
                    <span>Blockers: {formatMetric(selectedNode.metrics?.blockers)}</span>
                    <span>Decisions: {formatMetric(selectedNode.metrics?.decisions)}</span>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                      Connected items
                    </p>
                    {selectedConnections.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No direct links yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedConnections.map((connection) => (
                          <div
                            key={`${selectedNode.id}-${connection.id}`}
                            className="flex items-center justify-between rounded-lg border border-border/40 bg-background/70 px-3 py-2 text-sm"
                          >
                            <div>
                              <p className="font-medium text-foreground">
                                {connection.label}
                              </p>
                              <p className="text-[11px] text-muted-foreground capitalize">
                                {connection.type} • {connection.relation}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {connection.weight}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-card/30 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-widest">
                    Insights
                  </span>
                </div>
                {insights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No insights yet. Connect Slack + Linear to build context.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {insights.map((insight) => (
                      <div
                        key={insight.title}
                        className={cn(
                          'rounded-lg border border-border/40 bg-background/70 p-3',
                          insight.level === 'warning' &&
                            'border-amber-500/40 bg-amber-500/10',
                        )}
                      >
                        <p className="text-sm font-medium text-foreground">
                          {insight.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {insight.detail}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 mt-2 capitalize">
                          {insight.level}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border/50 bg-card/30 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <CircleDot className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-widest">
                    Top connectors
                  </span>
                </div>
                {topConnectors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No teammate signals yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topConnectors.map((person) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between rounded-lg border border-border/40 bg-background/70 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground">
                          {person.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatMetric(person.metrics?.connections)} links
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
            <div className="rounded-2xl border border-border/50 bg-card/30 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Signal mix
                  </p>
                  <h2 className="text-lg font-semibold text-foreground">
                    Where the team is spending attention
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  Based on Linear + memory signals
                </span>
              </div>
              <SignalMixChart data={signalMix} />
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/30 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Collaboration load
                  </p>
                  <h2 className="text-lg font-semibold text-foreground">
                    Who connects the most work
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  Links across tickets, projects, and decisions
                </span>
              </div>
              <ConnectorBarChart data={connectorBars} />
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/30 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Team members
                </p>
                <h2 className="text-lg font-semibold text-foreground">
                  Signals by teammate
                </h2>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Stronger insights come from more signals.
              </div>
            </div>

            {people.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No teammates found yet.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {people.map((person) => (
                  <div
                    key={person.id}
                    className="rounded-xl border border-border/40 bg-background/70 p-4"
                  >
                    <p className="font-medium text-foreground">
                      {person.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatMetric(person.metrics?.connections)} connections
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>
                        Tickets: {formatMetric(person.metrics?.tickets)}
                      </span>
                      <span>PRs: {formatMetric(person.metrics?.prs)}</span>
                      <span>
                        Projects: {formatMetric(person.metrics?.projects)}
                      </span>
                      <span>
                        Blockers: {formatMetric(person.metrics?.blockers)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
