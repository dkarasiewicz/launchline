'use client';

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
