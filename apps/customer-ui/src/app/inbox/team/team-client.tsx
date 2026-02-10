'use client';

import {
  type ForwardRefExoticComponent,
  type RefAttributes,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { Button } from '@launchline/ui/components/ui/button';
import { LogoIcon } from '@launchline/ui/components/logo';
import { cn } from '@launchline/ui/lib/utils';
import {
  CircleDot,
  Inbox,
  Link2,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import type { ForceGraphMethods, ForceGraphProps } from 'react-force-graph-3d';

type ForceGraphComponent = ForwardRefExoticComponent<
  ForceGraphProps<ForceNode, ForceLink> &
    RefAttributes<ForceGraphMethods<ForceNode, ForceLink>>
>;

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Loading map...
    </div>
  ),
}) as ForceGraphComponent;

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

const TEAM_TIMELINE_QUERY = gql`
  query LineaMemoryTimeline($input: LineaMemoryTimelineInput!) {
    lineaMemoryTimeline(input: $input) {
      memories {
        id
        namespace
        category
        summary
        content
        importance
        createdAt
        updatedAt
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

type TimelineMemory = {
  id: string;
  namespace: string;
  category: string;
  summary: string;
  content: string;
  importance: number;
  createdAt?: string;
  updatedAt?: string;
};

type ForceNode = {
  id: string;
  label: string;
  type: string;
  metrics?: GraphNode['metrics'];
  connections: number;
  color: string;
  x?: number;
  y?: number;
  z?: number;
};

type ForceLink = {
  source: string | ForceNode;
  target: string | ForceNode;
  type: string;
  weight?: number;
};

const nodeColors: Record<string, string> = {
  person: '#38bdf8',
  team: '#22c55e',
  project: '#f59e0b',
  ticket: '#6366f1',
  pr: '#d946ef',
  decision: '#eab308',
  other: '#94a3b8',
};

const primaryTypes = ['person', 'project', 'ticket'] as const;
const primaryTypeLabels: Record<(typeof primaryTypes)[number], string> = {
  person: 'People',
  project: 'Projects',
  ticket: 'Tasks',
};
const nodeTypeLabels: Record<string, string> = {
  person: 'Person',
  project: 'Project',
  ticket: 'Task',
  team: 'Team',
  pr: 'PR',
  decision: 'Decision',
  other: 'Other',
};

const edgeStyles: Record<
  string,
  { color: string; width: number; dash?: number[]; opacity: number }
> = {
  assignment: { color: '#38bdf8', width: 1.4, opacity: 0.7 },
  project: { color: '#f59e0b', width: 1.2, dash: [6, 6], opacity: 0.6 },
  team: { color: '#22c55e', width: 1.2, dash: [2, 5], opacity: 0.55 },
  blocker: { color: '#ef4444', width: 2.4, opacity: 0.9 },
  decision: { color: '#eab308', width: 1.8, dash: [1, 4], opacity: 0.75 },
  collaboration: { color: '#94a3b8', width: 1.1, dash: [4, 6], opacity: 0.4 },
  contributes: { color: '#a855f7', width: 1.2, dash: [3, 5], opacity: 0.55 },
  repo_pr: { color: '#ec4899', width: 1.4, opacity: 0.6 },
  author: { color: '#f472b6', width: 1.2, opacity: 0.6 },
};

function formatMetric(value?: number) {
  return typeof value === 'number' ? value : 0;
}

function formatTypeLabel(type: string, plural = false) {
  if (plural && type in primaryTypeLabels) {
    return primaryTypeLabels[type as (typeof primaryTypes)[number]];
  }
  return nodeTypeLabels[type] || type;
}

function formatTimelineDate(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function truncateText(value: string, max = 160) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3).trimEnd()}...`;
}

const relationLabels: Record<string, string> = {
  assignment: 'Assignments',
  project: 'Projects',
  team: 'Team ties',
  blocker: 'Blockers',
  decision: 'Decisions',
  collaboration: 'Collaboration',
  contributes: 'Contributions',
  repo_pr: 'PRs',
  author: 'Authorship',
};

const linkLegendItems = [
  { type: 'assignment', label: 'Assignment' },
  { type: 'project', label: 'Project' },
  { type: 'blocker', label: 'Blocker' },
  { type: 'decision', label: 'Decision' },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function withAlpha(color: string, alpha: number) {
  if (!color.startsWith('#')) {
    return color;
  }
  const hex = color.replace('#', '');
  if (hex.length < 6) {
    return color;
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getLinkEndpointId(endpoint: ForceLink['source']) {
  if (typeof endpoint === 'string') return endpoint;
  if (typeof endpoint === 'number') return (endpoint as number).toString();
  return endpoint?.id?.toString() ?? '';
}

function getIssueFlags(node: {
  type: string;
  metrics?: GraphNode['metrics'];
  connections?: number;
}) {
  const blockers = formatMetric(node.metrics?.blockers);
  const decisions = formatMetric(node.metrics?.decisions);
  const connections = formatMetric(
    node.connections ?? node.metrics?.connections,
  );
  const isSilo = node.type === 'person' && connections <= 2;
  const isBlockerHotspot = blockers >= 2;
  const isDecisionHeavy = decisions >= 3;
  return {
    isSilo,
    isBlockerHotspot,
    isDecisionHeavy,
    blockers,
    decisions,
    connections,
  };
}

function TeamGraph3D({
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
  const graphRef = useRef<ForceGraphMethods<ForceNode, ForceLink>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 980, height: 520 });
  const [hoveredNode, setHoveredNode] = useState<ForceNode | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(320, Math.floor(rect.height)),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const scene = useMemo(() => {
    const maxNodes = 240;
    const maxEdges = 600;

    const sortedNodes = [...nodes].sort(
      (a, b) =>
        formatMetric(b.metrics?.connections) -
        formatMetric(a.metrics?.connections),
    );
    const visibleNodes = sortedNodes.slice(0, maxNodes);
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    );
    const weightedEdges = [...visibleEdges].sort(
      (a, b) => (b.weight ?? 1) - (a.weight ?? 1),
    );
    const trimmedEdges = weightedEdges.slice(0, maxEdges);

    const baseNodes: ForceNode[] = visibleNodes.map((node) => {
      const connections = formatMetric(node.metrics?.connections);
      return {
        id: node.id,
        label: node.label,
        type: node.type,
        metrics: node.metrics,
        connections,
        color: nodeColors[node.type] || nodeColors.other,
      };
    });

    const baseLinks: ForceLink[] = trimmedEdges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      weight: edge.weight,
    }));

    return {
      graphData: {
        nodes: baseNodes,
        links: baseLinks,
      },
    };
  }, [nodes, edges]);

  const activeId = hoveredNode?.id ?? selectedId ?? null;
  const activeConnectedIds = useMemo(() => {
    if (!activeId) return null;
    const connected = new Set<string>();
    scene.graphData.links.forEach((edge) => {
      const sourceId = getLinkEndpointId(edge.source);
      const targetId = getLinkEndpointId(edge.target);
      if (sourceId === activeId || targetId === activeId) {
        connected.add(sourceId);
        connected.add(targetId);
      }
    });
    connected.add(activeId);
    return connected;
  }, [activeId, scene.graphData.links]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const linkForce = graph.d3Force('link') as
      | { distance?: (val: (link: ForceLink) => number) => void }
      | undefined;
    linkForce?.distance?.((link: ForceLink) =>
      link.type === 'blocker' ? 130 : 90,
    );
    const chargeForce = graph.d3Force('charge') as
      | { strength?: (val: number) => void }
      | undefined;
    chargeForce?.strength?.(-140);
    graph.d3ReheatSimulation();
    const timeout = setTimeout(() => {
      graph.zoomToFit(700, 26);
    }, 200);
    return () => clearTimeout(timeout);
  }, [
    scene.graphData.nodes.length,
    scene.graphData.links.length,
    dimensions.width,
    dimensions.height,
  ]);

  if (!nodes.length) {
    return (
      <div className="flex h-[520px] items-center justify-center text-sm text-muted-foreground">
        Connect Slack + Linear to build a collaboration map.
      </div>
    );
  }

  const linkColor = (link: ForceLink) => {
    const style = edgeStyles[link.type] || { color: '#94a3b8', opacity: 0.4 };
    const sourceId = getLinkEndpointId(link.source);
    const targetId = getLinkEndpointId(link.target);
    const highlighted =
      activeId && (sourceId === activeId || targetId === activeId);
    if (activeId && !highlighted) {
      return withAlpha(style.color, hoveredNode ? 0.12 : 0.08);
    }
    return withAlpha(style.color, style.opacity ?? 0.5);
  };

  const nodeColor = (node: ForceNode) => {
    const baseColor = node.color;
    if (!activeId) {
      return withAlpha(baseColor, 0.86);
    }
    if (activeConnectedIds?.has(node.id)) {
      return withAlpha(baseColor, 0.95);
    }
    return withAlpha(baseColor, hoveredNode ? 0.22 : 0.16);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-[520px] w-full overflow-hidden rounded-2xl border border-border/50 bg-card/40"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_55%),radial-gradient(circle_at_20%_80%,_rgba(234,179,8,0.12),_transparent_45%)]" />
      <div className="relative z-10 h-full w-full">
        <ForceGraph3D
          ref={graphRef}
          graphData={scene.graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(15, 23, 42, 0)"
          showNavInfo={false}
          enableNodeDrag={false}
          numDimensions={2}
          nodeRelSize={3}
          nodeVal={(node: ForceNode) =>
            clamp(Math.sqrt(node.connections + 1) * 0.9, 1.4, 4.2)
          }
          nodeColor={nodeColor}
          nodeLabel={(node: ForceNode) =>
            `${node.label} · ${nodeTypeLabels[node.type] || node.type} · ${
              node.connections
            } links`
          }
          linkColor={linkColor}
          linkWidth={(link: ForceLink) => {
            const style = edgeStyles[link.type] || { width: 1 };
            const weightBoost = clamp((link.weight ?? 1) * 0.15, 0, 1.6);
            const sourceId = getLinkEndpointId(link.source);
            const targetId = getLinkEndpointId(link.target);
            const highlighted =
              selectedId &&
              (sourceId === selectedId || targetId === selectedId);
            return style.width + weightBoost + (highlighted ? 0.6 : 0);
          }}
          linkCurvature={0.18}
          showPointerCursor={(obj) => Boolean(obj && 'id' in obj)}
          onNodeHover={(node: ForceNode | null) => {
            if (!node) {
              setHoveredNode(null);
              return;
            }
            setHoveredNode(node);
          }}
          onNodeClick={(node: ForceNode) => {
            onSelect?.(node.id);
          }}
          onBackgroundClick={() => onSelect?.(null)}
        />
      </div>

      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-border/40 bg-background/70 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur-sm">
        Drag to pan · Scroll to zoom · Click to lock
      </div>
    </div>
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
  const [activeTypes, setActiveTypes] = useState({
    person: true,
    project: true,
    ticket: true,
    other: false,
  });

  const otherTypes = useMemo(() => {
    const types = new Set(nodes.map((node) => node.type));
    return Array.from(types).filter(
      (type) => !primaryTypes.includes(type as (typeof primaryTypes)[number]),
    );
  }, [nodes]);

  const visibleNodes = useMemo(
    () =>
      nodes.filter((node) => {
        if (primaryTypes.includes(node.type as (typeof primaryTypes)[number])) {
          return activeTypes[node.type as (typeof primaryTypes)[number]];
        }
        return activeTypes.other;
      }),
    [nodes, activeTypes],
  );

  const visibleEdges = useMemo(() => {
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    return edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    );
  }, [edges, visibleNodes]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const stillVisible = visibleNodes.some(
      (node) => node.id === selectedNodeId,
    );
    if (!stillVisible) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, visibleNodes]);

  const entityCounts = useMemo(() => {
    const counts = { person: 0, project: 0, ticket: 0, other: 0 };
    nodes.forEach((node) => {
      if (node.type === 'person') counts.person += 1;
      else if (node.type === 'project') counts.project += 1;
      else if (node.type === 'ticket') counts.ticket += 1;
      else counts.other += 1;
    });
    return counts;
  }, [nodes]);

  const nodeLookup = useMemo(
    () => new Map(visibleNodes.map((node) => [node.id, node])),
    [visibleNodes],
  );

  const people = useMemo(
    () => visibleNodes.filter((node) => node.type === 'person'),
    [visibleNodes],
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

  const selectedNode = useMemo(
    () => visibleNodes.find((node) => node.id === selectedNodeId) ?? null,
    [visibleNodes, selectedNodeId],
  );

  const timelineInput = useMemo(() => {
    if (!selectedNode) return null;
    return {
      entityId: selectedNode.id,
      entityType: selectedNode.type,
      limit: 40,
    };
  }, [selectedNode]);

  const {
    data: timelineData,
    loading: timelineLoading,
    error: timelineError,
  } = useQuery<{
    lineaMemoryTimeline: { memories: TimelineMemory[] };
  }>(TEAM_TIMELINE_QUERY, {
    variables: timelineInput ? { input: timelineInput } : undefined,
    skip: !timelineInput,
    fetchPolicy: 'cache-and-network',
  });

  const timelineMemories = timelineData?.lineaMemoryTimeline?.memories ?? [];

  const selectedConnectionEdges = useMemo(() => {
    if (!selectedNode) return [];
    return visibleEdges.filter(
      (edge) =>
        edge.source === selectedNode.id || edge.target === selectedNode.id,
    );
  }, [selectedNode, visibleEdges]);

  const selectedConnections = useMemo(() => {
    if (!selectedNode) {
      return [];
    }

    return selectedConnectionEdges
      .map((edge) => {
        const counterpartId =
          edge.source === selectedNode.id ? edge.target : edge.source;
        const counterpart = nodeLookup.get(counterpartId);
        return {
          id: counterpartId,
          label: counterpart?.label || counterpartId,
          type: counterpart?.type || 'other',
          weight: edge.weight ?? 1,
          relation: edge.type,
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }, [nodeLookup, selectedConnectionEdges, selectedNode]);

  const selectedConnectionsPreview = useMemo(
    () => selectedConnections.slice(0, 8),
    [selectedConnections],
  );

  const selectedRelations = useMemo(() => {
    if (!selectedNode) return [];
    const counts = new Map<string, number>();
    selectedConnectionEdges.forEach((edge) => {
      counts.set(edge.type, (counts.get(edge.type) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([relation, count]) => ({
        relation,
        label: relationLabels[relation] || relation,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [selectedConnectionEdges, selectedNode]);

  const selectedConnectionTypes = useMemo(() => {
    if (!selectedNode) return [];
    const counts = new Map<string, number>();
    selectedConnections.forEach((connection) => {
      counts.set(connection.type, (counts.get(connection.type) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([type, count]) => ({
        type,
        label: formatTypeLabel(type, true),
        count,
        color: nodeColors[type] || nodeColors.other,
      }))
      .sort((a, b) => b.count - a.count);
  }, [selectedConnections, selectedNode]);

  const selectedHighlights = useMemo(() => {
    if (!selectedNode) return [];
    const notes: string[] = [];
    const issue = getIssueFlags({
      type: selectedNode.type,
      metrics: selectedNode.metrics,
      connections: formatMetric(selectedNode.metrics?.connections),
    });
    const prs = formatMetric(selectedNode.metrics?.prs);
    const tickets = formatMetric(selectedNode.metrics?.tickets);

    if (issue.blockers >= 2) {
      notes.push(`Blocker hotspot: ${issue.blockers} blockers tied here.`);
    }
    if (issue.connections <= 2) {
      notes.push(`Silo risk: only ${issue.connections} direct links.`);
    }
    if (issue.decisions >= 3) {
      notes.push(`Decision-heavy node (${issue.decisions}).`);
    }
    if (prs >= 4 && tickets <= 1) {
      notes.push(`Code-heavy signal: ${prs} PRs with few tickets.`);
    }

    if (selectedRelations.length > 0) {
      const headline = selectedRelations
        .map((relation) => `${relation.label} (${relation.count})`)
        .join(', ');
      notes.push(`Top link types: ${headline}.`);
    }

    if (selectedConnections.length > 0) {
      const strongest = selectedConnections
        .slice(0, 2)
        .map((connection) => connection.label)
        .join(' · ');
      notes.push(`Strongest links: ${strongest}.`);
    }

    if (!notes.length) {
      notes.push('Links look balanced. No obvious risk flags detected.');
    }

    return notes.slice(0, 4);
  }, [selectedNode, selectedRelations, selectedConnections]);

  const filterButtonClass = (active: boolean) =>
    cn(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] transition',
      active
        ? 'border-transparent bg-foreground/10 text-foreground'
        : 'border-border/50 text-muted-foreground hover:text-foreground',
    );

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
                Track how people, projects, and tasks connect. Filter the
                network to keep the story focused and inspect any node for
                relationship detail.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Refresh map
            </Button>
          </header>

          <div className="grid gap-6 xl:grid-cols-[2.2fr,1fr]">
            <div className="min-w-0 rounded-2xl border border-border/50 bg-card/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Link2 className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-widest">
                    Link map
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Showing {visibleNodes.length} nodes • {visibleEdges.length}{' '}
                  links
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {primaryTypes.map((type) => {
                  const count = entityCounts[type];
                  const active = activeTypes[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setActiveTypes((prev) => ({
                          ...prev,
                          [type]: !prev[type],
                        }))
                      }
                      className={cn(
                        filterButtonClass(active),
                        'disabled:pointer-events-none disabled:opacity-40',
                      )}
                      disabled={count === 0}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: nodeColors[type] }}
                      />
                      {primaryTypeLabels[type]}
                      <span className="text-[10px] text-muted-foreground/70">
                        {count}
                      </span>
                    </button>
                  );
                })}
                {otherTypes.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTypes((prev) => ({
                        ...prev,
                        other: !prev.other,
                      }))
                    }
                    className={cn(
                      filterButtonClass(activeTypes.other),
                      'disabled:pointer-events-none disabled:opacity-40',
                    )}
                    disabled={entityCounts.other === 0}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: nodeColors.other }}
                    />
                    Other
                    <span className="text-[10px] text-muted-foreground/70">
                      {entityCounts.other}
                    </span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mb-4">
                {linkLegendItems.map((item) => {
                  const style = edgeStyles[item.type];
                  return (
                    <div key={item.type} className="flex items-center gap-2">
                      <span
                        className="h-px w-6"
                        style={{
                          borderTopWidth: 2,
                          borderTopStyle: style?.dash ? 'dashed' : 'solid',
                          borderTopColor: style?.color ?? '#94a3b8',
                        }}
                      />
                      {item.label}
                    </div>
                  );
                })}
                <span className="text-muted-foreground/70">
                  Thickness = strength
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
              ) : visibleNodes.length === 0 ? (
                <div className="flex h-[520px] items-center justify-center text-sm text-muted-foreground">
                  No nodes match the current filters.
                </div>
              ) : (
                <TeamGraph3D
                  nodes={visibleNodes}
                  edges={visibleEdges}
                  selectedId={selectedNodeId}
                  onSelect={setSelectedNodeId}
                />
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-card/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-widest">
                      Node details
                    </span>
                  </div>
                  {selectedNode && (
                    <span className="text-xs text-muted-foreground">
                      {formatTypeLabel(selectedNode.type)}
                    </span>
                  )}
                </div>
                {!selectedNode ? (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Click a node to inspect connections and ownership.</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>People: {entityCounts.person}</span>
                      <span>Projects: {entityCounts.project}</span>
                      <span>Tasks: {entityCounts.ticket}</span>
                      <span>Other: {entityCounts.other}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {selectedNode.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTypeLabel(selectedNode.type)} ·{' '}
                        {formatMetric(selectedNode.metrics?.connections)} links
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>
                        Tickets: {formatMetric(selectedNode.metrics?.tickets)}
                      </span>
                      <span>
                        PRs: {formatMetric(selectedNode.metrics?.prs)}
                      </span>
                      <span>
                        Projects: {formatMetric(selectedNode.metrics?.projects)}
                      </span>
                      <span>
                        Blockers: {formatMetric(selectedNode.metrics?.blockers)}
                      </span>
                    </div>

                    {selectedConnectionTypes.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                          Connected entities
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {selectedConnectionTypes.map((connection) => (
                            <span
                              key={connection.type}
                              className="flex items-center gap-2 rounded-full border border-border/50 bg-background/70 px-2 py-1"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: connection.color }}
                              />
                              {connection.label} · {connection.count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedRelations.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                          Link mix
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {selectedRelations.map((relation) => (
                            <span
                              key={relation.relation}
                              className="rounded-full border border-border/50 bg-background/70 px-2 py-1"
                              style={{
                                borderColor:
                                  edgeStyles[relation.relation]?.color ??
                                  undefined,
                              }}
                            >
                              {relation.label} · {relation.count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                        Highlights
                      </p>
                      <div className="space-y-2 text-sm text-foreground">
                        {selectedHighlights.map((note) => (
                          <div
                            key={note}
                            className="rounded-lg border border-border/40 bg-background/70 px-3 py-2 text-[12px] text-muted-foreground"
                          >
                            {note}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                        Connected items
                      </p>
                      {selectedConnectionsPreview.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No direct links yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedConnectionsPreview.map((connection) => (
                            <div
                              key={`${selectedNode.id}-${connection.id}`}
                              className="flex items-center justify-between rounded-lg border border-border/40 bg-background/70 px-3 py-2 text-sm"
                            >
                              <div className="flex items-start gap-2">
                                <span
                                  className="mt-1 h-2 w-2 rounded-full"
                                  style={{
                                    background:
                                      nodeColors[connection.type] ??
                                      nodeColors.other,
                                  }}
                                />
                                <div>
                                  <p className="font-medium text-foreground">
                                    {connection.label}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {formatTypeLabel(connection.type)} ·{' '}
                                    {relationLabels[connection.relation] ||
                                      connection.relation}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {connection.weight}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                        Timeline
                      </p>
                      {timelineLoading ? (
                        <p className="text-sm text-muted-foreground">
                          Loading linked memories...
                        </p>
                      ) : timelineError ? (
                        <p className="text-sm text-muted-foreground">
                          Failed to load linked memories.
                        </p>
                      ) : timelineMemories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No linked memories yet.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {timelineMemories.map((memory) => (
                            <div
                              key={memory.id}
                              className="rounded-lg border border-border/40 bg-background/70 px-3 py-2 text-sm"
                            >
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span className="capitalize">
                                  {memory.category}
                                </span>
                                <span>{formatTimelineDate(memory.createdAt)}</span>
                              </div>
                              <p className="mt-1 font-medium text-foreground">
                                {memory.summary}
                              </p>
                              <p className="mt-1 text-[12px] text-muted-foreground">
                                {truncateText(memory.content)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

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
                {!activeTypes.person ? (
                  <p className="text-sm text-muted-foreground">
                    Enable People to surface connectors.
                  </p>
                ) : topConnectors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No teammate signals yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topConnectors.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => setSelectedNodeId(person.id)}
                        className="flex w-full items-center justify-between rounded-lg border border-border/40 bg-background/70 px-3 py-2 text-sm transition hover:border-border/60 hover:bg-background/90"
                      >
                        <span className="font-medium text-foreground">
                          {person.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatMetric(person.metrics?.connections)} links
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
