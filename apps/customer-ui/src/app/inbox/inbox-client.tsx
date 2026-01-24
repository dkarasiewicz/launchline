'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useSubscription } from '@apollo/client/react';
import { gql } from '@apollo/client';
import Link from 'next/link';
import { LogoIcon } from '@launchline/ui/components/logo';
import { Button } from '@launchline/ui/components/ui/button';
import { Badge } from '@launchline/ui/components/ui/badge';
import {
  InboxLineaThread,
  InboxItemType,
  GeneralLineaThread,
} from '@launchline/ui/components/inbox/inbox-thread';
import { cn } from '@launchline/ui/lib/utils';

// Assistant-UI imports
import { useAssistantApi } from '@assistant-ui/react';

// Custom Runtime Provider
import { LaunchlineRuntimeProvider, THREADS_QUERY } from '@launchline/ui';

// Integrations query
const INTEGRATIONS_QUERY = gql`
  query Integrations {
    integrations {
      integrations {
        id
        type
        status
      }
    }
  }
`;

const LINEA_CHANGED_SUBSCRIPTION = gql`
  subscription LineaChanged {
    lineaChanged {
      id
      type
      changedAt
    }
  }
`;

import {
  Inbox,
  Settings,
  Check,
  AlertTriangle,
  TrendingDown,
  FileText,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
  Command,
  Eye,
  EyeOff,
  Clock,
  ArrowUpDown,
  X,
  ChevronRight,
  Sparkles,
  MessageSquare,
  Users,
} from 'lucide-react';

// Priority config
const priorityConfig: Record<
  string,
  { label: string; color: string; icon: typeof ArrowUp }
> = {
  critical: { label: 'Critical', color: 'text-rose-400', icon: ArrowUp },
  high: { label: 'High', color: 'text-amber-400', icon: ArrowUp },
  medium: { label: 'Medium', color: 'text-foreground/60', icon: Minus },
  low: { label: 'Low', color: 'text-foreground/40', icon: ArrowDown },
};

// Type config
const typeConfig: Record<
  InboxItemType,
  { label: string; icon: typeof AlertTriangle; color: string; bgColor: string }
> = {
  blocker: {
    label: 'Blocker',
    icon: AlertTriangle,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/15',
  },
  drift: {
    label: 'Drift',
    icon: TrendingDown,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
  },
  stalled: {
    label: 'Stalled',
    icon: Clock,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
  },
  update: {
    label: 'Update',
    icon: FileText,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/15',
  },
  coverage: {
    label: 'Coverage',
    icon: Zap,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
  },
  risk: {
    label: 'Risk',
    icon: AlertTriangle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
  },
  action_required: {
    label: 'Action',
    icon: Zap,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/15',
  },
};

const resolvedStatusSet = new Set([
  'actioned',
  'auto-resolved',
  'auto_resolved',
  'closed',
  'dismissed',
  'archived',
]);

const isResolvedItem = (item: { status?: string; threadStatus?: string }) =>
  resolvedStatusSet.has(item.status || '') || item.threadStatus === 'archived';

// TimeAgo component (hydration safe)
function TimeAgo({ date }: { date: Date }) {
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    const calculateTimeAgo = () => {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      return `${diffDays}d`;
    };

    setTimeAgo(calculateTimeAgo());
    const interval = setInterval(() => setTimeAgo(calculateTimeAgo()), 60000);
    return () => clearInterval(interval);
  }, [date]);

  if (!timeAgo) return <span className="text-muted-foreground">...</span>;
  return <span>{timeAgo}</span>;
}

// Command Palette
function CommandPalette({
  open,
  onClose,
  onCommand,
}: {
  open: boolean;
  onClose: () => void;
  onCommand: (cmd: string) => void;
}) {
  const [search, setSearch] = useState('');

  const commands = [
    { id: 'resolve', label: 'Resolve item', shortcut: 'E' },
    { id: 'assign', label: 'Assign to...', shortcut: 'A' },
    { id: 'priority', label: 'Set priority', shortcut: 'P' },
    { id: 'quick-action', label: 'Quick action (auto)', shortcut: 'Q' },
    { id: 'next', label: 'Next item', shortcut: 'J' },
    { id: 'prev', label: 'Previous item', shortcut: 'K' },
    { id: 'settings', label: 'Open settings', shortcut: ',' },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <Command className="w-4 h-4 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-auto p-2">
          {filtered.map((cmd) => (
            <button
              key={cmd.id}
              onClick={() => {
                onCommand(cmd.id);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
            >
              <span>{cmd.label}</span>
              <kbd className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {cmd.shortcut}
              </kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyThreadState({
  hasActiveItems,
  hasResolvedItems,
}: {
  hasActiveItems: boolean;
  hasResolvedItems: boolean;
}) {
  const title = hasActiveItems
    ? 'Select an inbox item'
    : 'All caught up for now';
  const description = hasActiveItems
    ? 'Pick an item on the left to review context or resolve it. Linea is also available in Slack when you need a quick answer.'
    : 'Linea runs a heartbeat every 30 minutes and will surface blockers, drift, and risks as they appear. You can ask Linea in Slack anytime.';
  const detailLead = hasActiveItems
    ? 'Slack-first support'
    : 'What happens next';

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-xl px-8">
        <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-6">
          {hasActiveItems ? (
            <MessageSquare className="w-10 h-10 text-muted-foreground" />
          ) : (
            <Sparkles className="w-10 h-10 text-violet-400" />
          )}
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {title}
        </h2>
        <p className="text-muted-foreground">{description}</p>

        <div className="mt-6 text-left max-w-md mx-auto">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/70 mb-3">
            {detailLead}
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground/70" />
              DM or @mention Linea for quick answers
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground/70" />
              Heartbeat scans every 30 minutes
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-foreground/70" />
              Scheduled digests live in Settings
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Link href="/inbox/settings">
            <Button variant="outline" className="h-9 px-4">
              Open Settings
            </Button>
          </Link>
        </div>

        {hasResolvedItems && !hasActiveItems && (
          <p className="mt-4 text-xs text-muted-foreground/70">
            Toggle “show resolved” to review past items.
          </p>
        )}
      </div>
    </div>
  );
}

// Keyboard shortcuts help
function KeyboardHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const shortcuts = [
    { key: 'J / K', desc: 'Navigate items' },
    { key: 'E', desc: 'Resolve selected' },
    { key: 'A', desc: 'Assign to...' },
    { key: 'P', desc: 'Set priority' },
    { key: 'Q', desc: 'Quick action (auto)' },
    { key: '⌘ K', desc: 'Command palette' },
    { key: ',', desc: 'Settings' },
    { key: '?', desc: 'This help' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-xl p-5 w-full max-w-xs shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Keyboard shortcuts</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{s.desc}</span>
              <kbd className="text-xs bg-muted px-2 py-1 rounded font-mono">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main page component wrapped with runtime provider
export default function InboxClient() {
  return (
    <LaunchlineRuntimeProvider>
      <InboxPageContent />
    </LaunchlineRuntimeProvider>
  );
}

// Inner component that uses assistant-ui hooks
function InboxPageContent() {
  // Get threads from assistant-ui runtime using new API
  // Query all thread data including inbox metadata
  const {
    data: threadsData,
    loading,
    refetch: refetchThreads,
  } = useQuery<{
    threads: {
      threads: {
        remoteId: string;
        status: string;
        title?: string;
        createdAt?: string;
        updatedAt?: string;
        isInboxThread?: boolean;
        inboxItemType?: string;
        inboxPriority?: string;
        inboxStatus?: string;
        summary?: string;
        projectId?: string;
        featureId?: string;
      }[];
    };
  }>(THREADS_QUERY);

  // Query integrations status
  const {
    data: integrationsData,
    loading: integrationsLoading,
    refetch: refetchIntegrations,
  } = useQuery<{
    integrations: {
      integrations: {
        id: string;
        type: string;
        status: string;
      }[];
    };
  }>(INTEGRATIONS_QUERY, {
    fetchPolicy: 'network-only',
  });

  // Get runtime to access thread list for archiving
  const assistantApi = useAssistantApi();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | InboxItemType>('all');
  const [showResolved, setShowResolved] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem('linea.showResolved') === 'true';
  });
  const [sortBy, setSortBy] = useState<'priority' | 'time'>('priority');
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [justResolvedId, setJustResolvedId] = useState<string | null>(null);
  const [pendingResolveId, setPendingResolveId] = useState<string | null>(null);
  const [optimisticArchivedIds, setOptimisticArchivedIds] = useState<string[]>(
    [],
  );

  useSubscription(LINEA_CHANGED_SUBSCRIPTION, {
    onData: ({ data }) => {
      const event = data.data?.lineaChanged;
      if (!event) return;
      void refetchThreads();
      void refetchIntegrations();
    },
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      'linea.showResolved',
      showResolved ? 'true' : 'false',
    );
  }, [showResolved]);

  useEffect(() => {
    if (!threadsData?.threads?.threads?.length) {
      return;
    }

    const archivedIds = new Set(
      threadsData.threads.threads
        .filter((thread) => (thread.status || '').toLowerCase() === 'archived')
        .map((thread) => thread.remoteId),
    );

    setOptimisticArchivedIds((prev) => {
      const next = prev.filter((id) => !archivedIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [threadsData]);

  const normalizeIntegrationValue = useCallback(
    (value?: string) => (value || '').toLowerCase(),
    [],
  );

  const generalThread = useMemo(() => {
    if (!threadsData?.threads?.threads) {
      return null;
    }

    const thread = threadsData.threads.threads.find(
      (candidate) =>
        !candidate.isInboxThread &&
        (candidate.status || '').toLowerCase() !== 'archived',
    );

    if (!thread) {
      return null;
    }

    return {
      id: thread.remoteId,
      title: thread.title || 'General chat',
      updatedAt: thread.updatedAt || thread.createdAt,
    };
  }, [threadsData]);

  const linearIntegration = useMemo(() => {
    if (!integrationsData?.integrations?.integrations) {
      return null;
    }

    return (
      integrationsData.integrations.integrations.find(
        (integration) =>
          normalizeIntegrationValue(integration.type) === 'linear',
      ) || null
    );
  }, [integrationsData, normalizeIntegrationValue]);

  const linearIntegrationStatus = useMemo(() => {
    if (!linearIntegration) {
      return null;
    }

    return normalizeIntegrationValue(linearIntegration.status);
  }, [linearIntegration, normalizeIntegrationValue]);

  // Check if Linear is connected
  const hasLinearIntegration = useMemo(() => {
    if (integrationsLoading || !integrationsData?.integrations?.integrations) {
      return undefined;
    }

    if (!linearIntegration) {
      return false;
    }

    return !['revoked', 'expired'].includes(linearIntegrationStatus || '');
  }, [
    integrationsData,
    integrationsLoading,
    linearIntegration,
    linearIntegrationStatus,
  ]);

  const integrationsReady =
    !integrationsLoading && typeof hasLinearIntegration === 'boolean';

  // Map GraphQL threads to inbox items
  const items = useMemo(() => {
    if (loading || !threadsData?.threads?.threads) {
      return [];
    }

    const optimisticArchivedSet = new Set(optimisticArchivedIds);

    const mapped = threadsData.threads.threads
      .filter((thread) => thread.isInboxThread)
      .map((thread) => {
        const isOptimisticArchived = optimisticArchivedSet.has(thread.remoteId);
        const normalizedThreadStatus =
          isOptimisticArchived ||
          (thread.status || '').toLowerCase() === 'archived'
            ? 'archived'
            : 'regular';
        const fallbackStatus =
          normalizedThreadStatus === 'archived' ? 'archived' : 'pending';

        return {
          id: thread.remoteId,
          externalId: thread.remoteId,
          type: (
            thread.inboxItemType || 'update'
          ).toLowerCase() as InboxItemType,
          status: thread.inboxStatus?.toLowerCase() || fallbackStatus,
          threadStatus: normalizedThreadStatus,
          priority: thread.inboxPriority?.toLowerCase() || 'medium',
          title: thread.title || 'Untitled',
          summary: thread.summary || '',
          timestamp: thread.createdAt ? new Date(thread.createdAt) : new Date(),
          projectId: thread.projectId || '',
          featureId: thread.featureId || '',
          linkedContexts: [],
          messages: [],
          executionLogs: [],
        };
      });

    return mapped.filter(
      (item) => showResolved || item.threadStatus !== 'archived',
    );
  }, [threadsData, loading, showResolved, optimisticArchivedIds]);

  // Resolve function using assistant-ui runtime's archive
  const resolveItem = useCallback(
    async (itemId: string) => {
      try {
        setOptimisticArchivedIds((prev) =>
          prev.includes(itemId) ? prev : [...prev, itemId],
        );
        await assistantApi.threads().item({ id: itemId }).archive();
        await refetchThreads();
      } catch (error) {
        setOptimisticArchivedIds((prev) =>
          prev.filter((id) => id !== itemId),
        );
        console.error('Failed to archive thread:', error);
      }
    },
    [assistantApi, refetchThreads],
  );

  // Filter and sort items
  const filteredItems = useMemo(() => {
    const result = items.filter((item) => {
      const isResolved = isResolvedItem(item);
      if (!showResolved && isResolved) return false;
      if (filterType !== 'all' && item.type !== filterType) return false;
      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const diff =
          (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) -
          (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
        if (diff !== 0) return diff;
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    return result;
  }, [items, filterType, showResolved, sortBy]);

  // Active vs resolved counts
  const activeItems = useMemo(
    () => filteredItems.filter((item) => !isResolvedItem(item)),
    [filteredItems],
  );
  const resolvedItems = useMemo(
    () => filteredItems.filter((item) => isResolvedItem(item)),
    [filteredItems],
  );
  const allActiveItems = useMemo(
    () => items.filter((item) => !isResolvedItem(item)),
    [items],
  );
  const allResolvedItems = useMemo(
    () => items.filter((item) => isResolvedItem(item)),
    [items],
  );
  const typeCounts = useMemo(() => {
    const counts: Record<InboxItemType, number> = {
      blocker: 0,
      drift: 0,
      stalled: 0,
      update: 0,
      coverage: 0,
      risk: 0,
      action_required: 0,
    };

    for (const item of allActiveItems) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }

    return counts;
  }, [allActiveItems]);
  const urgentCount = useMemo(
    () =>
      allActiveItems.filter((item) =>
        ['critical', 'high'].includes(item.priority),
      ).length,
    [allActiveItems],
  );

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId),
    [items, selectedItemId],
  );

  const isGeneralSelected =
    !!generalThread?.id && selectedItemId === generalThread.id;

  useEffect(() => {
    if (pendingResolveId) {
      const timeout = setTimeout(() => {
        resolveItem(pendingResolveId);
        setJustResolvedId(pendingResolveId);
        setPendingResolveId(null);
      }, 400); // Wait for animation
      return () => clearTimeout(timeout);
    }
  }, [pendingResolveId, resolveItem]);

  useEffect(() => {
    if (justResolvedId) {
      const timeout = setTimeout(() => {
        // Find next active item or clear selection
        const remainingActive = items.filter(
          (item) => !isResolvedItem(item) && item.id !== justResolvedId,
        );
        if (remainingActive.length > 0) {
          setSelectedItemId(remainingActive[0].id);
        } else if (generalThread?.id) {
          setSelectedItemId(generalThread.id);
        } else {
          setSelectedItemId(null);
        }
        setJustResolvedId(null);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [justResolvedId, items]);

  const handleResolve = useCallback(
    (itemId?: string) => {
      const idToResolve = itemId || selectedItem?.id;
      if (!idToResolve || pendingResolveId) return;
      if (!showResolved) {
        setShowResolved(true);
      }
      setPendingResolveId(idToResolve);
    },
    [selectedItem, pendingResolveId, showResolved],
  );

  const handleQuickAction = useCallback(
    (itemId?: string) => {
      const idToResolve = itemId || selectedItem?.id;
      if (!idToResolve || pendingResolveId) return;
      if (!showResolved) {
        setShowResolved(true);
      }
      setPendingResolveId(idToResolve);
    },
    [selectedItem, pendingResolveId, showResolved],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Skip if modal is open
      if (commandOpen || helpOpen) {
        if (e.key === 'Escape') {
          setCommandOpen(false);
          setHelpOpen(false);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'j': {
          e.preventDefault();
          const jIdx = activeItems.findIndex((i) => i.id === selectedItemId);
          if (jIdx < activeItems.length - 1) {
            setSelectedItemId(activeItems[jIdx + 1].id);
          }
          break;
        }
        case 'k': {
          e.preventDefault();
          const kIdx = activeItems.findIndex((i) => i.id === selectedItemId);
          if (kIdx > 0) {
            setSelectedItemId(activeItems[kIdx - 1].id);
          }
          break;
        }
        case 'e':
          e.preventDefault();
          handleResolve();
          break;
        case 'q':
          e.preventDefault();
          handleQuickAction();
          break;
        case ',':
          e.preventDefault();
          window.location.href = '/inbox/settings';
          break;
        case '?':
          e.preventDefault();
          setHelpOpen(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedItemId,
    activeItems,
    handleResolve,
    handleQuickAction,
    commandOpen,
    helpOpen,
  ]);

  // Handle command
  const handleCommand = useCallback(
    (cmd: string) => {
      switch (cmd) {
        case 'resolve':
          handleResolve();
          break;
        case 'quick-action':
          handleQuickAction();
          break;
        case 'settings':
          window.location.href = '/inbox/settings';
          break;
      }
    },
    [handleResolve, handleQuickAction],
  );

  // Auto-select first item
  useEffect(() => {
    if (!selectedItemId && activeItems.length > 0) {
      setSelectedItemId(activeItems[0].id);
      return;
    }

    if (!selectedItemId && activeItems.length === 0 && generalThread?.id) {
      setSelectedItemId(generalThread.id);
    }
  }, [selectedItemId, activeItems, generalThread]);

  return (
    <div className="flex h-screen bg-background">
      {/* Minimal Sidebar */}
      <aside className="w-14 border-r border-border/50 flex flex-col items-center py-4 gap-2 bg-card/30 flex-shrink-0">
        <Link href="/" className="mb-3">
          <LogoIcon className="w-6 h-6 text-foreground" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary bg-primary/10 rounded-lg h-9 w-9"
        >
          <Inbox className="w-4 h-4" />
        </Button>
        <Link href="/inbox/team">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg h-9 w-9"
          >
            <Users className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1" />
        <Link href="/inbox/settings">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg h-9 w-9"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
      </aside>

      {/* Item List */}
      <div className="w-80 border-r border-border/50 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-semibold">Inbox</h1>
              <p className="text-xs text-muted-foreground">
                {allActiveItems.length} active
                {allResolvedItems.length > 0
                  ? ` · ${allResolvedItems.length} resolved`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setSortBy(sortBy === 'priority' ? 'time' : 'priority')
                  }
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title={`Sort by ${sortBy === 'priority' ? 'time' : 'priority'}`}
                >
                  {sortBy === 'priority' ? (
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowResolved(!showResolved)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title={showResolved ? 'Hide resolved' : 'Show resolved'}
                >
                  {showResolved ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none pr-6">
              <button
                onClick={() => setFilterType('all')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
                  filterType === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                All
                <span className="ml-1.5 opacity-70">
                  {allActiveItems.length}
                </span>
              </button>
              {(Object.keys(typeConfig) as InboxItemType[]).map((type) => {
                const count = allActiveItems.filter(
                  (item) => item.type === type,
                ).length;
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 flex items-center gap-1.5',
                      filterType === type
                        ? cn(typeConfig[type].bgColor, typeConfig[type].color)
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    {typeConfig[type].label}
                    {count > 0 && <span className="opacity-70">{count}</span>}
                  </button>
                );
              })}
            </div>
            {/* Fade mask at the end */}
            <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
          </div>

          {hasLinearIntegration && allActiveItems.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Blockers</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <p className="mt-1 text-lg font-semibold text-rose-400">
                  {typeCounts.blocker}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Drift</span>
                  <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="mt-1 text-lg font-semibold text-amber-400">
                  {typeCounts.drift}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Risks</span>
                  <Zap className="w-3.5 h-3.5 text-red-400" />
                </div>
                <p className="mt-1 text-lg font-semibold text-red-400">
                  {typeCounts.risk}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>High priority</span>
                  <ArrowUp className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <p className="mt-1 text-lg font-semibold text-amber-300">
                  {urgentCount}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-auto p-2">
          {generalThread && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedItemId(generalThread.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedItemId(generalThread.id);
                }
              }}
              className={cn(
                'w-full text-left p-3 rounded-xl mb-2 border border-border/50 bg-muted/20 transition-shadow',
                selectedItemId === generalThread.id
                  ? 'ring-1 ring-border'
                  : 'hover:ring-1 ring-border',
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {generalThread.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Always-on Linea thread for quick questions and planning.
                  </p>
                </div>
                {generalThread.updatedAt && (
                  <span className="text-xs text-muted-foreground">
                    <TimeAgo date={new Date(generalThread.updatedAt)} />
                  </span>
                )}
              </div>
            </div>
          )}
          {hasLinearIntegration === false ? (
            <div className="flex flex-col items-center justify-center text-center p-6 h-full">
              <div className="w-14 h-14 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-violet-400" />
              </div>
              <p className="font-medium text-foreground/90">
                Get started with Linea
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-[200px]">
                Connect Linear to surface blockers, drift, and hidden work
              </p>
              <div className="mt-4">
                <Link href="/inbox/settings">
                  <Button variant="outline" size="sm">
                    Open Settings
                  </Button>
                </Link>
              </div>
            </div>
          ) : hasLinearIntegration === undefined ? (
            <div className="flex flex-col items-center justify-center text-center p-6 h-full">
              <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground/80">
                Loading your workspace
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Fetching integrations and inbox items
              </p>
            </div>
          ) : allActiveItems.length === 0 && !showResolved ? (
            <div className="flex flex-col items-center justify-center text-center p-6 h-full">
              <div className="w-12 h-12 rounded-full bg-status-success/10 flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-status-success" />
              </div>
              <p className="font-medium text-foreground/80">All caught up</p>
              <p className="text-sm text-muted-foreground mt-1">
                No items need attention
              </p>
            </div>
          ) : activeItems.length === 0 && !showResolved ? (
            <div className="flex flex-col items-center justify-center text-center p-6 h-full">
              <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                <Minus className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground/80">
                No items for this filter
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Try another type or show resolved
              </p>
            </div>
          ) : (
            <>
              {activeItems.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedItemId(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedItemId(item.id);
                    }
                  }}
                  className={cn(
                    'w-full text-left p-3 rounded-xl mb-1 transition-shadow group cursor-pointer',
                    selectedItemId === item.id
                      ? 'ring-1 ring-border'
                      : 'hover:ring-1 ring-border',
                    pendingResolveId === item.id && 'animate-resolve',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {pendingResolveId === item.id ? (
                      <div className="w-5 h-5 rounded-full bg-status-success/20 flex items-center justify-center mt-0.5 flex-shrink-0 animate-check-pop">
                        <Check className="w-3 h-3 text-status-success" />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                          typeConfig[item.type].bgColor,
                        )}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.summary}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={cn(
                            'text-xs',
                            priorityConfig[item.priority]?.color,
                          )}
                        >
                          {priorityConfig[item.priority]?.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          <TimeAgo date={item.timestamp} />
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickAction(item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Quick action (Q)"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {showResolved && resolvedItems.length > 0 && (
                <>
                  <div className="px-3 py-2 mt-4">
                    <p className="text-xs text-muted-foreground font-medium">
                      Resolved ({resolvedItems.length})
                    </p>
                  </div>
                  {resolvedItems.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedItemId(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedItemId(item.id);
                        }
                      }}
                      className={cn(
                        'w-full text-left p-3 rounded-xl mb-1 transition-shadow opacity-50 cursor-pointer',
                        selectedItemId === item.id
                          ? 'bg-accent/50 ring-1 ring-border'
                          : 'hover:bg-accent/30',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-status-success/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <Check className="w-3 h-3 text-status-success" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate line-through">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <TimeAgo date={item.timestamp} />
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Keyboard hint */}
        <div className="px-4 py-2 border-t border-border/50">
          <button
            onClick={() => setHelpOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">?</kbd>
            <span>Keyboard shortcuts</span>
          </button>
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedItem ? (
          <>
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    typeConfig[selectedItem.type].bgColor,
                  )}
                >
                  {(() => {
                    const IconComponent = typeConfig[selectedItem.type].icon;
                    return (
                      <IconComponent
                        className={cn(
                          'w-4 h-4',
                          typeConfig[selectedItem.type].color,
                        )}
                      />
                    );
                  })()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-medium truncate">
                    {selectedItem.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    <TimeAgo date={selectedItem.timestamp} /> ago
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    priorityConfig[selectedItem.priority].color,
                  )}
                >
                  {priorityConfig[selectedItem.priority].label}
                </Badge>
                {!isResolvedItem(selectedItem) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResolve()}
                    className="h-8 text-xs bg-transparent"
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Resolve
                  </Button>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-status-success/10 text-status-success"
                  >
                    Resolved
                  </Badge>
                )}
              </div>
            </div>

            {/* Linea Chat Thread */}
            <InboxLineaThread
              key={selectedItem.id}
              itemId={selectedItem.id}
              itemContext={{
                title: selectedItem.title,
                summary: selectedItem.summary,
                type: selectedItem.type,
                priority: selectedItem.priority,
                linkedContexts: selectedItem.linkedContexts,
              }}
            />
          </>
        ) : isGeneralSelected && generalThread ? (
          <>
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-medium truncate">
                    {generalThread.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Always-on workspace thread
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-xs text-muted-foreground"
              >
                Main
              </Badge>
            </div>

            <GeneralLineaThread key={generalThread.id} threadId={generalThread.id} />
          </>
        ) : !integrationsReady ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-8">
              <div className="w-20 h-20 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Loading your workspace
              </h2>
              <p className="text-muted-foreground">
                Syncing integrations and inbox items...
              </p>
            </div>
          </div>
        ) : !hasLinearIntegration ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-10 h-10 text-violet-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Welcome to your Execution Inbox
              </h2>
              <p className="text-muted-foreground mb-6">
                Connect Linear in Settings to surface blockers, stalled work,
                and priority drift. Linea keeps you ahead without dashboard
                noise.
              </p>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  className="h-9 px-4"
                  onClick={() => {
                    window.location.href = '/inbox/settings';
                  }}
                >
                  Open Settings
                </Button>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4 text-left">
                <div className="p-4 rounded-lg bg-muted/30">
                  <AlertTriangle className="w-5 h-5 text-rose-400 mb-2" />
                  <p className="text-sm font-medium">Blocker Detection</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Get notified when work is stuck
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <TrendingDown className="w-5 h-5 text-amber-400 mb-2" />
                  <p className="text-sm font-medium">Priority Drift</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Catch shifting priorities early
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <Zap className="w-5 h-5 text-violet-400 mb-2" />
                  <p className="text-sm font-medium">Hidden Impact</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Surface invisible contributions
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <Sparkles className="w-5 h-5 text-sky-400 mb-2" />
                  <p className="text-sm font-medium">AI Insights</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Get context-aware suggestions
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : hasLinearIntegration === undefined ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-8">
              <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Loading Linea
              </h2>
              <p className="text-muted-foreground mb-6">
                Syncing your workspace signals
              </p>
            </div>
          </div>
        ) : (
          <EmptyThreadState
            hasActiveItems={allActiveItems.length > 0}
            hasResolvedItems={allResolvedItems.length > 0}
          />
        )}
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onCommand={handleCommand}
      />

      {/* Keyboard Help */}
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
