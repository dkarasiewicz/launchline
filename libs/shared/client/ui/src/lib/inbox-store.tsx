'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

// Inbox Item Types
export type InboxItemType = 'blocker' | 'drift' | 'update' | 'coverage';
export type InboxItemStatus =
  | 'new'
  | 'pending'
  | 'actioned'
  | 'auto-resolved'
  | 'closed'
  | 'dismissed';
export type InboxItemPriority = 'critical' | 'high' | 'medium' | 'low';

export interface InboxAction {
  id: string;
  label: string;
  variant: 'default' | 'destructive' | 'outline';
  icon?: string;
  toolType?:
    | 'assign'
    | 'clarify'
    | 'linear-status'
    | 'priority'
    | 'slack'
    | 'resolve'
    | 'dismiss';
}

export type MessageType =
  | 'text'
  | 'context-cards'
  | 'action-buttons'
  | 'assign-picker'
  | 'priority-picker'
  | 'confirmation'
  | 'plan-steps';

export interface InboxMessage {
  id: string;
  role: 'agent' | 'user' | 'system';
  type: MessageType;
  content: string;
  timestamp: Date;
  // For context-cards type
  contexts?: LinkedContext[];
  // For action-buttons type
  actions?: InboxAction[];
  // For assign-picker / priority-picker type
  pickerState?: 'pending' | 'confirmed' | 'cancelled';
  pickerValue?: string;
  // For plan-steps type
  steps?: { id: string; label: string; completed: boolean }[];
  // For confirmation type
  confirmationData?: { action: string; value: string; label: string };
}

export interface LinearContext {
  type: 'linear';
  id: string;
  ticketId: string;
  title: string;
  status: string;
  assignee?: string;
  dependencies?: string[];
  url?: string;
}

export interface GitHubContext {
  type: 'github';
  id: string;
  prNumber: string;
  title: string;
  status: 'open' | 'closed' | 'merged' | 'draft';
  lastActivity: string;
  author?: string;
  url?: string;
}

export interface SlackContext {
  type: 'slack';
  id: string;
  channel: string;
  message: string;
  author: string;
  timestamp: string;
  url?: string;
}

export type LinkedContext = LinearContext | GitHubContext | SlackContext;

export interface ExecutionLog {
  id: string;
  timestamp: Date;
  actor: 'agent' | 'user' | 'system';
  action: string;
  details?: string;
}

export interface InboxItem {
  id: string;
  type: InboxItemType;
  status: InboxItemStatus;
  priority: InboxItemPriority;
  title: string;
  summary: string;
  timestamp: Date;
  projectId: string;
  featureId?: string;
  linkedContexts: LinkedContext[];
  messages: InboxMessage[];
  executionLogs: ExecutionLog[];
  snoozedUntil?: Date;
}

export const MOCK_INBOX_ITEMS: InboxItem[] = [
  {
    id: 'inbox-1',
    type: 'blocker',
    status: 'new',
    priority: 'critical',
    title: 'PR #214 stalled - API contract blocker',
    summary:
      "PR hasn't progressed for 3 days. Comments indicate confusion about the API contract.",
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    projectId: 'shared-lists',
    featureId: 'auth-system',
    linkedContexts: [
      {
        type: 'linear',
        id: 'ctx-1',
        ticketId: 'AUTH-142',
        title: 'Implement OAuth flow',
        status: 'Blocked',
        assignee: 'Unassigned',
        dependencies: ['API Spec', 'Backend team'],
        url: '#',
      },
      {
        type: 'github',
        id: 'ctx-2',
        prNumber: '214',
        title: 'Add API handling for OAuth',
        status: 'open',
        lastActivity: '3 days ago',
        author: 'alex',
        url: '#',
      },
      {
        type: 'slack',
        id: 'ctx-3',
        channel: '#dev-api',
        message:
          "I'm blocked because the spec isn't finalized. Can someone from backend clarify the expected payload format?",
        author: 'Alex',
        timestamp: '2h ago',
        url: '#',
      },
    ],
    messages: [
      {
        id: 'msg-1',
        role: 'agent',
        type: 'text',
        content:
          "I noticed PR #214 hasn't progressed for 3 days. Comments indicate confusion about the API contract.\n\nLinear ticket AUTH-142 is linked and marked as **blocked**. The developer mentioned in Slack they're waiting for spec clarification from backend.",
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
      },
      {
        id: 'msg-1b',
        role: 'agent',
        type: 'context-cards',
        content: "Here's the connected context I found:",
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        contexts: [
          {
            type: 'linear',
            id: 'ctx-1',
            ticketId: 'AUTH-142',
            title: 'Implement OAuth flow',
            status: 'Blocked',
            assignee: 'Unassigned',
            url: '#',
          },
          {
            type: 'github',
            id: 'ctx-2',
            prNumber: '214',
            title: 'Add API handling for OAuth',
            status: 'open',
            lastActivity: '3 days ago',
            author: 'alex',
            url: '#',
          },
          {
            type: 'slack',
            id: 'ctx-3',
            channel: '#dev-api',
            message: "I'm blocked because the spec isn't finalized...",
            author: 'Alex',
            timestamp: '2h ago',
            url: '#',
          },
        ],
      },
      {
        id: 'msg-1c',
        role: 'agent',
        type: 'action-buttons',
        content: 'What would you like to do?',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        actions: [
          {
            id: 'assign',
            label: 'Assign Owner',
            variant: 'default',
            toolType: 'assign',
          },
          {
            id: 'clarify',
            label: 'Ask for Clarification',
            variant: 'outline',
            toolType: 'clarify',
          },
          {
            id: 'priority',
            label: 'Adjust Priority',
            variant: 'outline',
            toolType: 'priority',
          },
          {
            id: 'slack',
            label: 'Discuss in Slack',
            variant: 'outline',
            toolType: 'slack',
          },
        ],
      },
    ],
    executionLogs: [
      {
        id: 'log-1',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        actor: 'agent',
        action: 'Detected blocker',
        details: 'PR #214 stalled for 3 days',
      },
    ],
  },
  {
    id: 'inbox-2',
    type: 'drift',
    status: 'new',
    priority: 'high',
    title: 'Priority drift: Feature B progressing while A blocked',
    summary:
      'Work continues on dependent feature while blocker unresolved. Potential rework risk.',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    projectId: 'shared-lists',
    linkedContexts: [
      {
        type: 'linear',
        id: 'ctx-4',
        ticketId: 'FEAT-A',
        title: 'Feature A - Core Auth',
        status: 'Blocked',
        assignee: 'Alex',
        url: '#',
      },
      {
        type: 'linear',
        id: 'ctx-5',
        ticketId: 'FEAT-B',
        title: 'Feature B - User Profiles',
        status: 'In Progress',
        assignee: 'Sarah',
        url: '#',
      },
    ],
    messages: [
      {
        id: 'msg-2',
        role: 'agent',
        type: 'text',
        content:
          "I detected a priority drift:\n\nWork is actively progressing on **Feature B** (User Profiles) while **Feature A** (Core Auth) remains blocked for 3 days.\n\n**Risk:** Feature B depends on Feature A's auth tokens. Continuing may cause significant rework.",
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: 'msg-2b',
        role: 'agent',
        type: 'context-cards',
        content: 'Related tickets:',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        contexts: [
          {
            type: 'linear',
            id: 'ctx-4',
            ticketId: 'FEAT-A',
            title: 'Feature A - Core Auth',
            status: 'Blocked',
            assignee: 'Alex',
            url: '#',
          },
          {
            type: 'linear',
            id: 'ctx-5',
            ticketId: 'FEAT-B',
            title: 'Feature B - User Profiles',
            status: 'In Progress',
            assignee: 'Sarah',
            url: '#',
          },
        ],
      },
      {
        id: 'msg-2c',
        role: 'agent',
        type: 'action-buttons',
        content:
          'Recommendation: Either pause Feature B or prioritize unblocking Feature A.',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        actions: [
          {
            id: 'pause-b',
            label: 'Pause Feature B',
            variant: 'default',
            toolType: 'linear-status',
          },
          {
            id: 'reassign',
            label: 'Reassign Resources',
            variant: 'outline',
            toolType: 'assign',
          },
          {
            id: 'dismiss',
            label: 'Dismiss Risk',
            variant: 'outline',
            toolType: 'dismiss',
          },
        ],
      },
    ],
    executionLogs: [
      {
        id: 'log-2',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        actor: 'agent',
        action: 'Detected priority drift',
        details: 'Feature B progressing while Feature A blocked',
      },
    ],
  },
  {
    id: 'inbox-3',
    type: 'coverage',
    status: 'new',
    priority: 'medium',
    title: 'Test coverage dropped below threshold',
    summary:
      'Auth module coverage dropped from 85% to 72% after recent changes.',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    projectId: 'shared-lists',
    linkedContexts: [
      {
        type: 'github',
        id: 'ctx-7',
        prNumber: '212',
        title: 'Refactor auth middleware',
        status: 'merged',
        lastActivity: '1 day ago',
        author: 'alex',
        url: '#',
      },
    ],
    messages: [
      {
        id: 'msg-3',
        role: 'agent',
        type: 'text',
        content:
          'The **auth module** coverage dropped from 85% to 72% after PR #212 was merged.\n\n**Affected files:**\n- `src/auth/middleware.ts` (new code, no tests)\n- `src/auth/tokens.ts` (modified, tests outdated)\n\n**Threshold:** 80% required for production',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
      },
      {
        id: 'msg-3b',
        role: 'agent',
        type: 'context-cards',
        content: 'Related PR:',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        contexts: [
          {
            type: 'github',
            id: 'ctx-7',
            prNumber: '212',
            title: 'Refactor auth middleware',
            status: 'merged',
            lastActivity: '1 day ago',
            author: 'alex',
            url: '#',
          },
        ],
      },
      {
        id: 'msg-3c',
        role: 'agent',
        type: 'action-buttons',
        content: 'What would you like to do?',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        actions: [
          {
            id: 'create-ticket',
            label: 'Create Test Ticket',
            variant: 'default',
            toolType: 'linear-status',
          },
          {
            id: 'assign',
            label: 'Assign to Author',
            variant: 'outline',
            toolType: 'assign',
          },
          {
            id: 'dismiss',
            label: 'Dismiss',
            variant: 'outline',
            toolType: 'dismiss',
          },
        ],
      },
    ],
    executionLogs: [
      {
        id: 'log-3',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        actor: 'system',
        action: 'Coverage check failed',
        details: '72% < 80% threshold',
      },
    ],
  },
  {
    id: 'inbox-4',
    type: 'update',
    status: 'pending',
    priority: 'medium',
    title: 'Weekly project update ready',
    summary:
      'Your weekly project update for MVP Core is ready for review and posting.',
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    projectId: 'shared-lists',
    linkedContexts: [],
    messages: [
      {
        id: 'msg-4',
        role: 'agent',
        type: 'text',
        content:
          "Here's your weekly project update draft:\n\n**Completed this week:**\n- User authentication flow (AUTH-140, AUTH-141)\n- Database schema updates (DB-087, DB-088)\n\n**In progress:**\n- OAuth integration (AUTH-142) - **blocked**\n- User profile page (PROF-001)\n\n**Blockers:**\n- AUTH-142: Waiting on API contract from backend team",
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        id: 'msg-4b',
        role: 'agent',
        type: 'action-buttons',
        content: 'Ready to share?',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        actions: [
          {
            id: 'post-linear',
            label: 'Post to Linear',
            variant: 'default',
            toolType: 'linear-status',
          },
          {
            id: 'post-slack',
            label: 'Post to Slack',
            variant: 'outline',
            toolType: 'slack',
          },
          { id: 'edit', label: 'Edit First', variant: 'outline' },
        ],
      },
    ],
    executionLogs: [
      {
        id: 'log-4',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        actor: 'agent',
        action: 'Generated weekly update',
      },
    ],
  },
  {
    id: 'inbox-5',
    type: 'blocker',
    status: 'actioned',
    priority: 'high',
    title: 'DB-089 migration script failing',
    summary:
      'Database migration failing in staging environment. Assigned to Sarah.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    projectId: 'shared-lists',
    linkedContexts: [
      {
        type: 'linear',
        id: 'ctx-9',
        ticketId: 'DB-089',
        title: 'Database migration v2.3',
        status: 'In Progress',
        assignee: 'Sarah',
        url: '#',
      },
    ],
    messages: [
      {
        id: 'msg-5',
        role: 'agent',
        type: 'text',
        content:
          'Migration script failure detected:\n\n**Error:** Foreign key constraint violation in `users` table during `user_preferences` migration.\n\n**Environment:** Staging\n**Last successful run:** 2 days ago',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: 'msg-5b',
        role: 'agent',
        type: 'context-cards',
        content: 'Related:',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        contexts: [
          {
            type: 'linear',
            id: 'ctx-9',
            ticketId: 'DB-089',
            title: 'Database migration v2.3',
            status: 'In Progress',
            assignee: 'Sarah',
            url: '#',
          },
        ],
      },
      {
        id: 'msg-5c',
        role: 'agent',
        type: 'assign-picker',
        content: 'Who should handle this?',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        pickerState: 'confirmed',
        pickerValue: 'sarah',
      },
      {
        id: 'msg-5d',
        role: 'agent',
        type: 'confirmation',
        content: "Done! I've assigned this to Sarah and notified her on Slack.",
        timestamp: new Date(Date.now() - 90 * 60 * 1000),
        confirmationData: {
          action: 'assign',
          value: 'sarah',
          label: 'Sarah Kim',
        },
      },
    ],
    executionLogs: [
      {
        id: 'log-5',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        actor: 'system',
        action: 'Migration failed',
        details: 'FK constraint violation',
      },
      {
        id: 'log-6',
        timestamp: new Date(Date.now() - 90 * 60 * 1000),
        actor: 'user',
        action: 'Assigned to Sarah',
      },
      {
        id: 'log-7',
        timestamp: new Date(Date.now() - 89 * 60 * 1000),
        actor: 'agent',
        action: 'Sent Slack notification',
        details: 'DM to @sarah',
      },
    ],
  },
  {
    id: 'inbox-6',
    type: 'update',
    status: 'closed',
    priority: 'low',
    title: 'Sprint retrospective summary',
    summary: 'Sprint 12 retrospective highlights compiled and shared.',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    projectId: 'shared-lists',
    linkedContexts: [],
    messages: [
      {
        id: 'msg-8',
        role: 'agent',
        type: 'text',
        content:
          'Sprint 12 retrospective summary:\n\n**What went well:**\n- Fast iteration on UI components\n- Good cross-team collaboration\n\n**What could improve:**\n- Earlier blocker escalation\n- Better test coverage on new code',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ],
    executionLogs: [
      {
        id: 'log-9',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        actor: 'agent',
        action: 'Generated retro summary',
      },
      {
        id: 'log-10',
        timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000),
        actor: 'user',
        action: 'Posted to Slack',
      },
    ],
  },
];

export const TEAM_MEMBERS = [
  { id: 'alex', name: 'Alex Chen', avatar: 'A', role: 'Frontend' },
  { id: 'sarah', name: 'Sarah Kim', avatar: 'S', role: 'Backend' },
  { id: 'mike', name: 'Mike Johnson', avatar: 'M', role: 'Full-stack' },
  { id: 'emma', name: 'Emma Wilson', avatar: 'E', role: 'DevOps' },
];

// Context
interface InboxContextType {
  items: InboxItem[];
  selectedItem: InboxItem | null;
  setSelectedItem: (item: InboxItem | null) => void;
  filterType: InboxItemType | 'all';
  setFilterType: (type: InboxItemType | 'all') => void;
  updateItemStatus: (itemId: string, status: InboxItemStatus) => void;
  resolveItem: (itemId: string) => void;
  updateMessage: (
    itemId: string,
    messageId: string,
    updates: Partial<InboxMessage>,
  ) => void;
  addMessage: (
    itemId: string,
    message: Omit<InboxMessage, 'id' | 'timestamp'>,
  ) => void;
  addExecutionLog: (
    itemId: string,
    log: Omit<ExecutionLog, 'id' | 'timestamp'>,
  ) => void;
}

const InboxContext = createContext<InboxContextType | null>(null);

export function InboxProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InboxItem[]>(MOCK_INBOX_ITEMS);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [filterType, setFilterType] = useState<InboxItemType | 'all'>('all');

  const updateItemStatus = (itemId: string, status: InboxItemStatus) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status } : item)),
    );
    if (selectedItem?.id === itemId) {
      setSelectedItem((prev) => (prev ? { ...prev, status } : null));
    }
  };

  const resolveItem = (itemId: string) => {
    updateItemStatus(itemId, 'closed');
  };

  const updateMessage = (
    itemId: string,
    messageId: string,
    updates: Partial<InboxMessage>,
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              messages: item.messages.map((msg) =>
                msg.id === messageId ? { ...msg, ...updates } : msg,
              ),
            }
          : item,
      ),
    );
    if (selectedItem?.id === itemId) {
      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((msg) =>
                msg.id === messageId ? { ...msg, ...updates } : msg,
              ),
            }
          : null,
      );
    }
  };

  const addMessage = (
    itemId: string,
    message: Omit<InboxMessage, 'id' | 'timestamp'>,
  ) => {
    const newMessage: InboxMessage = {
      ...message,
      id: `msg-${Date.now()}`,
      timestamp: new Date(),
    };
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, messages: [...item.messages, newMessage] }
          : item,
      ),
    );
    if (selectedItem?.id === itemId) {
      setSelectedItem((prev) =>
        prev ? { ...prev, messages: [...prev.messages, newMessage] } : null,
      );
    }
  };

  const addExecutionLog = (
    itemId: string,
    log: Omit<ExecutionLog, 'id' | 'timestamp'>,
  ) => {
    const newLog: ExecutionLog = {
      ...log,
      id: `log-${Date.now()}`,
      timestamp: new Date(),
    };
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, executionLogs: [...item.executionLogs, newLog] }
          : item,
      ),
    );
    if (selectedItem?.id === itemId) {
      setSelectedItem((prev) =>
        prev
          ? { ...prev, executionLogs: [...prev.executionLogs, newLog] }
          : null,
      );
    }
  };

  return (
    <InboxContext.Provider
      value={{
        items,
        selectedItem,
        setSelectedItem,
        filterType,
        setFilterType,
        updateItemStatus,
        resolveItem,
        updateMessage,
        addMessage,
        addExecutionLog,
      }}
    >
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox() {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error('useInbox must be used within InboxProvider');
  }
  return context;
}
