'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { LogoIcon } from '@launchline/ui/components/logo';
import { Button } from '@launchline/ui/components/ui/button';
import { Badge } from '@launchline/ui/components/ui/badge';
import { cn } from '@launchline/ui/lib/utils';

// Define inbox item types locally (these will be stored as thread metadata)
export type InboxItemType = 'blocker' | 'drift' | 'update' | 'coverage';
export type LinkedContext = any; // TODO: Import from a shared types file

// Assistant-UI imports
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  AssistantIf,
  useAssistantState,
  useAssistantApi,
} from '@assistant-ui/react';

// Custom Runtime Provider
import { LaunchlineRuntimeProvider } from '@launchline/ui';

// Tool UIs
import {
  SearchMemoriesTool,
  GetInboxItemsTool,
  UpdateLinearTicketToolUI,
  SendSlackMessageToolUI,
  GenerateProjectUpdateTool,
  WriteTodosToolUI,
} from '@launchline/ui/components/tools/linea/LineaTools';

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
  Send,
  Command,
  Eye,
  EyeOff,
  Sparkles,
  Clock,
  ArrowUpDown,
  X,
  User,
  ChevronRight,
  ArrowDownIcon,
  RefreshCwIcon,
  CopyIcon,
  CheckIcon,
  SquareIcon,
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
};

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

// ============================================================================
// LINEA ASSISTANT-UI THREAD COMPONENT
// ============================================================================

/**
 * InboxLineaThread - Assistant-UI powered chat for inbox items
 *
 * Uses the selected thread from the runtime (each inbox item is a thread).
 */
function InboxLineaThread({
  itemId,
  itemContext,
}: {
  itemId: string;
  itemContext: {
    title: string;
    summary: string;
    type: InboxItemType;
    priority: string;
    linkedContexts?: LinkedContext[];
  };
}) {
  const api = useAssistantApi();

  // Switch to the thread for this inbox item
  useEffect(() => {
    if (itemId) {
      api.threads().switchToThread(itemId);
    }
  }, [itemId, api]);

  return (
    <div className="flex flex-col h-full">
      {/* Thread Messages - scrollable area */}
      <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0">
        <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
          {/* Spacer to push messages down */}
          <AssistantIf condition={({ thread }) => !thread.isEmpty}>
            <div className="min-h-8 flex-grow" />
          </AssistantIf>

          <div className="px-6 py-4 pb-24">
            <AssistantIf condition={({ thread }) => thread.isEmpty}>
              <InboxThreadWelcome context={itemContext} />
            </AssistantIf>

            <ThreadPrimitive.Messages
              components={{
                UserMessage: InboxUserMessage,
                AssistantMessage: InboxAssistantMessage,
              }}
            />
          </div>

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 pointer-events-none">
            <div className="flex justify-center pb-28">
              <ThreadPrimitive.ScrollToBottom asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full shadow-md bg-background border-border/50 disabled:invisible pointer-events-auto"
                >
                  <ArrowDownIcon className="h-4 w-4" />
                </Button>
              </ThreadPrimitive.ScrollToBottom>
            </div>
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>

      {/* Composer - sticky at bottom */}
      <div className="flex-shrink-0 p-4 bg-background border-t border-border/50">
        <InboxComposer />
      </div>

      {/* Register Tool UIs */}
      <SearchMemoriesTool />
      <GetInboxItemsTool />
      <GenerateProjectUpdateTool />
      {/* Human-in-the-loop Approval UIs */}
      <UpdateLinearTicketToolUI />
      <SendSlackMessageToolUI />
      {/* DeepAgents built-in write_todos for task planning */}
      <WriteTodosToolUI />
    </div>
  );
}

// ============================================================================

// Welcome message with inbox context
function InboxThreadWelcome({
  context,
}: {
  context: {
    title: string;
    type: InboxItemType;
    priority: string;
    summary: string;
  };
}) {
  const typeInfo = typeConfig[context.type];

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
          typeInfo.bgColor,
        )}
      >
        <Sparkles className={cn('w-6 h-6', typeInfo.color)} />
      </div>
      <h3 className="font-medium text-foreground mb-1">Hi, I&apos;m Linea</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        I&apos;m here to help you with this {context.type}. Ask me anything or
        use the suggested actions below.
      </p>

      {/* Quick action suggestions */}
      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        <ThreadPrimitive.Suggestion
          prompt="What's blocking this?"
          autoSend
          asChild
        >
          <Button variant="outline" size="sm" className="text-xs h-8">
            What&apos;s the blocker?
          </Button>
        </ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion
          prompt="Who should I assign this to?"
          autoSend
          asChild
        >
          <Button variant="outline" size="sm" className="text-xs h-8">
            Suggest assignee
          </Button>
        </ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion
          prompt="What are the next steps to resolve this?"
          autoSend
          asChild
        >
          <Button variant="outline" size="sm" className="text-xs h-8">
            Next steps
          </Button>
        </ThreadPrimitive.Suggestion>
      </div>
    </div>
  );
}

// User message component for inbox thread
function InboxUserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end gap-3 mb-4">
      <div className="max-w-[80%]">
        <div className="px-4 py-3 rounded-2xl rounded-tr-sm text-sm bg-primary text-primary-foreground shadow-sm">
          <MessagePrimitive.Parts />
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-muted-foreground" />
      </div>
    </MessagePrimitive.Root>
  );
}

// Assistant message component for inbox thread
function InboxAssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex gap-3 mb-4 group">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <div className="max-w-[80%]">
        <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm bg-card border border-border/50 shadow-sm">
          <MessagePrimitive.Parts />
        </div>
        {/* Fixed height container to prevent layout jump */}
        <div className="h-7 flex items-center">
          <InboxAssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

// Action bar for assistant messages - uses opacity for smooth show/hide
function InboxAssistantActionBar() {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <ActionBarPrimitive.Copy asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
        >
          <MessagePrimitive.If copied>
            <CheckIcon className="h-3 w-3" />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon className="h-3 w-3" />
          </MessagePrimitive.If>
        </Button>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
        >
          <RefreshCwIcon className="h-3 w-3" />
        </Button>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
}

// Composer for inbox thread
function InboxComposer() {
  return (
    <ComposerPrimitive.Root className="relative flex items-center gap-2">
      <div className="flex-1 relative">
        <ComposerPrimitive.Input
          placeholder="Ask Linea about this item..."
          className="w-full bg-muted/50 border border-border rounded-xl h-12 px-4 pr-12 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-all resize-none"
          autoFocus
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <AssistantIf condition={({ thread }) => !thread.isRunning}>
            <ComposerPrimitive.Send asChild>
              <Button
                size="icon"
                className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </ComposerPrimitive.Send>
          </AssistantIf>
          <AssistantIf condition={({ thread }) => thread.isRunning}>
            <ComposerPrimitive.Cancel asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-lg"
              >
                <SquareIcon className="w-3.5 h-3.5 fill-current" />
              </Button>
            </ComposerPrimitive.Cancel>
          </AssistantIf>
        </div>
      </div>
    </ComposerPrimitive.Root>
  );
}

// ============================================================================
// END LINEA ASSISTANT-UI COMPONENTS
// ============================================================================

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
export default function InboxPage() {
  return (
    <LaunchlineRuntimeProvider>
      <InboxPageContent />
    </LaunchlineRuntimeProvider>
  );
}

// Inner component that uses assistant-ui hooks
function InboxPageContent() {
  // Get threads from assistant-ui runtime using new API
  const threads = useAssistantState(({ threads }) => threads || []);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | InboxItemType>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [sortBy, setSortBy] = useState<'priority' | 'time'>('priority');
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [justResolvedId, setJustResolvedId] = useState<string | null>(null);
  const [pendingResolveId, setPendingResolveId] = useState<string | null>(null);

  // Map threads to inbox items format
  const items = useMemo(() => {
    return threads.threadItems.map((thread: any) => ({
      id: thread.threadId,
      externalId: thread.threadId,
      type: (thread.metadata?.inboxItemType || 'update') as InboxItemType,
      status: thread.metadata?.inboxStatus || 'new',
      priority: thread.metadata?.inboxPriority || 'medium',
      title: thread.title || 'Untitled',
      summary: thread.metadata?.summary || '',
      timestamp: thread.metadata?.createdAt
        ? new Date(thread.metadata.createdAt)
        : new Date(),
      projectId: thread.metadata?.projectId || '',
      featureId: thread.metadata?.featureId,
      linkedContexts: thread.metadata?.linkedContexts || [],
      messages: [],
      executionLogs: [],
    }));
  }, [threads]);

  // Resolve function using runtime
  const resolveItem = useCallback((itemId: string) => {
    // TODO: Implement delete via GraphQL mutation (deleteThread)
    // This will call the backend to archive/delete the thread
    console.log('Resolving item:', itemId);
    // Note: runtime.threadList doesn't have a delete method
    // We need to implement this via GraphQL mutation
  }, []);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    const result = items.filter((item) => {
      const isResolved = [
        'actioned',
        'auto-resolved',
        'closed',
        'dismissed',
      ].includes(item.status);
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
    () =>
      filteredItems.filter(
        (i) =>
          !['actioned', 'auto-resolved', 'closed', 'dismissed'].includes(
            i.status,
          ),
      ),
    [filteredItems],
  );
  const resolvedItems = useMemo(
    () =>
      filteredItems.filter((i) =>
        ['actioned', 'auto-resolved', 'closed', 'dismissed'].includes(i.status),
      ),
    [filteredItems],
  );

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId),
    [items, selectedItemId],
  );

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
          (i) =>
            !['actioned', 'auto-resolved', 'closed', 'dismissed'].includes(
              i.status,
            ) && i.id !== justResolvedId,
        );
        if (remainingActive.length > 0) {
          setSelectedItemId(remainingActive[0].id);
        } else {
          setSelectedItemId(null);
        }
        setJustResolvedId(null);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [justResolvedId, items]);

  const handleResolve = useCallback(() => {
    if (!selectedItem || pendingResolveId) return;
    setPendingResolveId(selectedItem.id);
  }, [selectedItem, pendingResolveId]);

  const handleQuickAction = useCallback(() => {
    if (!selectedItem || pendingResolveId) return;
    setPendingResolveId(selectedItem.id);
  }, [selectedItem, pendingResolveId]);

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
    }
  }, [selectedItemId, activeItems]);

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
            <h1 className="text-lg font-semibold">Inbox</h1>
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
                <span className="ml-1.5 opacity-70">{activeItems.length}</span>
              </button>
              {(Object.keys(typeConfig) as InboxItemType[]).map((type) => {
                const count = activeItems.filter((i) => i.type === type).length;
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
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-auto p-2">
          {activeItems.length === 0 && !showResolved ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="w-12 h-12 rounded-full bg-status-success/10 flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-status-success" />
              </div>
              <p className="font-medium text-foreground/80">All caught up</p>
              <p className="text-sm text-muted-foreground mt-1">
                No items need attention
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
                    'w-full text-left p-3 rounded-xl mb-1 transition-all group cursor-pointer',
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
                        setSelectedItemId(item.id);
                        setTimeout(handleQuickAction, 50);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
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
                        'w-full text-left p-3 rounded-xl mb-1 transition-all opacity-50 cursor-pointer',
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
                {!['actioned', 'auto-resolved', 'closed', 'dismissed'].includes(
                  selectedItem.status,
                ) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResolve}
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
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Inbox className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground font-medium">
                No thread selected
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Select an item from the list to view details
              </p>
            </div>
          </div>
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
