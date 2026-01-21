'use client';

/**
 * Approval Tool UIs
 *
 * Human-in-the-loop components for actions that require PM approval.
 * Uses addResult callback to send approval/rejection back to the backend.
 */

import { useState } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Edit2,
  MessageSquare,
  Send,
  Search,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

// ============================================================================
// SHARED ACTION BUTTONS COMPONENT
// ============================================================================

interface ApprovalAction {
  id: string;
  label: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  confirmLabel?: string;
  icon?: React.ReactNode;
}

interface ApprovalActionsProps {
  actions: ApprovalAction[];
  onAction: (actionId: string) => void;
  disabled?: boolean;
  confirmTimeout?: number;
}

function ApprovalActions({
  actions,
  onAction,
  disabled = false,
  confirmTimeout = 3000,
}: ApprovalActionsProps) {
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleClick = (action: ApprovalAction) => {
    if (action.confirmLabel && confirming !== action.id) {
      // First click - enter confirm state
      setConfirming(action.id);
      // Auto-reset after timeout
      setTimeout(() => setConfirming(null), confirmTimeout);
    } else {
      // Second click (confirm) or no confirmation needed
      setConfirming(null);
      onAction(action.id);
    }
  };

  return (
    <div className="flex gap-2 justify-end w-full">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant || 'secondary'}
          size="sm"
          disabled={disabled}
          onClick={() => handleClick(action)}
          className={cn(
            'transition-all',
            confirming === action.id && 'ring-2 ring-primary ring-offset-2',
          )}
        >
          {action.icon}
          {confirming === action.id ? action.confirmLabel : action.label}
        </Button>
      ))}
    </div>
  );
}

// ============================================================================
// UPDATE LINEAR TICKET APPROVAL UI
// ============================================================================

type UpdateLinearTicketArgs = {
  ticketId: string;
  status?: string;
  priority?: number;
  assignee?: string;
  comment?: string;
};

type UpdateLinearTicketResult = {
  approve?: boolean;
  edit?: boolean;
  reject?: boolean;
  error?: string;
  success?: boolean;
  message?: string;
};

export const UpdateLinearTicketToolUI = makeAssistantToolUI<
  UpdateLinearTicketArgs,
  string
>({
  toolName: 'update_linear_ticket',
  render: function UpdateLinearTicketUI({ args, result, status, addResult }) {
    let resultObj: UpdateLinearTicketResult = {};
    try {
      resultObj = result ? JSON.parse(result) : {};
    } catch {
      resultObj = { error: result || 'Unknown error' };
    }

    const handleApprove = () => {
      addResult(JSON.stringify({ approve: true }));
    };

    const handleReject = () => {
      addResult(JSON.stringify({ reject: true }));
    };

    const handleEdit = () => {
      addResult(JSON.stringify({ edit: true }));
    };

    const priorityLabels: Record<number, string> = {
      0: 'None',
      1: 'Urgent',
      2: 'High',
      3: 'Medium',
      4: 'Low',
    };

    const hasUpdates =
      args.status || args.priority !== undefined || args.assignee;
    const isPending = !result && status.type !== 'running';
    const isRunning = status.type === 'running';
    const wasApproved = resultObj.approve === true;
    const wasRejected =
      resultObj.reject === true || resultObj.approve === false;
    const wasEdited = resultObj.edit === true;

    return (
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader
          className={cn(
            'pb-3',
            wasApproved && 'bg-status-success-muted',
            wasRejected && 'bg-status-error-muted',
          )}
        >
          <div className="flex items-center gap-2">
            {wasApproved && (
              <CheckCircle className="h-5 w-5 text-status-success" />
            )}
            {wasRejected && <XCircle className="h-5 w-5 text-status-error" />}
            {!wasApproved && !wasRejected && (
              <AlertTriangle className="h-5 w-5 text-status-warning" />
            )}
            <CardTitle className="text-base font-semibold">
              {wasApproved
                ? 'Ticket Updated'
                : wasRejected
                  ? 'Update Rejected'
                  : 'Update Linear Ticket'}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          {/* Ticket ID */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ticket</span>
            <Badge variant="outline" className="font-mono">
              {args.ticketId}
            </Badge>
          </div>

          {/* Proposed Changes */}
          {hasUpdates && (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Proposed Changes
              </span>
              {args.status && (
                <div className="flex items-center justify-between text-sm">
                  <span>Status</span>
                  <Badge variant="secondary">{args.status}</Badge>
                </div>
              )}
              {args.priority !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span>Priority</span>
                  <Badge variant="secondary">
                    {priorityLabels[args.priority] || args.priority}
                  </Badge>
                </div>
              )}
              {args.assignee && (
                <div className="flex items-center justify-between text-sm">
                  <span>Assignee</span>
                  <Badge variant="secondary">{args.assignee}</Badge>
                </div>
              )}
            </div>
          )}

          {/* Comment */}
          {args.comment && (
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Comment to add
              </span>
              <p className="mt-1 text-sm">{args.comment}</p>
            </div>
          )}

          {/* Status Messages */}
          {isRunning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </div>
          )}

          {wasEdited && (
            <p className="text-sm text-muted-foreground">
              Edit requested - please provide updated details.
            </p>
          )}
        </CardContent>

        {/* Action Buttons - only show when pending */}
        {isPending && (
          <CardFooter className="border-t bg-muted/30 pt-4">
            <ApprovalActions
              actions={[
                {
                  id: 'reject',
                  label: 'Reject',
                  variant: 'destructive',
                  confirmLabel: 'Confirm Reject',
                  icon: <XCircle className="mr-1.5 h-4 w-4" />,
                },
                {
                  id: 'edit',
                  label: 'Edit',
                  variant: 'outline',
                  icon: <Edit2 className="mr-1.5 h-4 w-4" />,
                },
                {
                  id: 'approve',
                  label: 'Approve',
                  variant: 'default',
                  confirmLabel: 'Confirm Update',
                  icon: <CheckCircle className="mr-1.5 h-4 w-4" />,
                },
              ]}
              onAction={(id) => {
                if (id === 'approve') handleApprove();
                if (id === 'reject') handleReject();
                if (id === 'edit') handleEdit();
              }}
            />
          </CardFooter>
        )}
      </Card>
    );
  },
});

// ============================================================================
// SEND SLACK MESSAGE APPROVAL UI
// ============================================================================

type SendSlackMessageArgs = {
  channel: string;
  message: string;
  threadTs?: string;
};

type SendSlackMessageResult = {
  approve?: boolean;
  edit?: boolean;
  reject?: boolean;
  error?: string;
  success?: boolean;
};

export const SendSlackMessageToolUI = makeAssistantToolUI<
  SendSlackMessageArgs,
  string
>({
  toolName: 'send_slack_message',
  render: function SendSlackMessageUI({ args, result, status, addResult }) {
    let resultObj: SendSlackMessageResult = {};
    try {
      resultObj = result ? JSON.parse(result) : {};
    } catch {
      resultObj = { error: result || 'Unknown error' };
    }

    const handleApprove = () => {
      addResult(JSON.stringify({ approve: true }));
    };

    const handleReject = () => {
      addResult(JSON.stringify({ reject: true }));
    };

    const handleEdit = () => {
      addResult(JSON.stringify({ edit: true }));
    };

    const isPending = !result && status.type !== 'running';
    const isRunning = status.type === 'running';
    const wasApproved = resultObj.approve === true;
    const wasRejected =
      resultObj.reject === true || resultObj.approve === false;
    const wasEdited = resultObj.edit === true;

    return (
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader
          className={cn(
            'pb-3',
            wasApproved && 'bg-status-success-muted',
            wasRejected && 'bg-status-error-muted',
          )}
        >
          <div className="flex items-center gap-2">
            {wasApproved && (
              <CheckCircle className="h-5 w-5 text-status-success" />
            )}
            {wasRejected && <XCircle className="h-5 w-5 text-status-error" />}
            {!wasApproved && !wasRejected && (
              <MessageSquare className="h-5 w-5 text-status-info" />
            )}
            <CardTitle className="text-base font-semibold">
              {wasApproved
                ? 'Message Sent'
                : wasRejected
                  ? 'Message Cancelled'
                  : 'Send Slack Message'}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          {/* Channel */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Channel</span>
            <Badge variant="outline" className="font-mono">
              #{args.channel}
            </Badge>
          </div>

          {/* Thread */}
          {args.threadTs && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Thread Reply
              </span>
              <Badge variant="secondary">Yes</Badge>
            </div>
          )}

          {/* Message Preview */}
          <div className="rounded-lg border bg-background p-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Message Preview
            </span>
            <p className="mt-2 text-sm whitespace-pre-wrap">{args.message}</p>
          </div>

          {/* Status Messages */}
          {isRunning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Sending...</span>
            </div>
          )}

          {wasEdited && (
            <p className="text-sm text-muted-foreground">
              Edit requested - please provide updated message.
            </p>
          )}
        </CardContent>

        {/* Action Buttons - only show when pending */}
        {isPending && (
          <CardFooter className="border-t bg-muted/30 pt-4">
            <ApprovalActions
              actions={[
                {
                  id: 'reject',
                  label: 'Cancel',
                  variant: 'ghost',
                  icon: <XCircle className="mr-1.5 h-4 w-4" />,
                },
                {
                  id: 'edit',
                  label: 'Edit',
                  variant: 'outline',
                  icon: <Edit2 className="mr-1.5 h-4 w-4" />,
                },
                {
                  id: 'approve',
                  label: 'Send',
                  variant: 'default',
                  confirmLabel: 'Confirm Send',
                  icon: <Send className="mr-1.5 h-4 w-4" />,
                },
              ]}
              onAction={(id) => {
                if (id === 'approve') handleApprove();
                if (id === 'reject') handleReject();
                if (id === 'edit') handleEdit();
              }}
            />
          </CardFooter>
        )}
      </Card>
    );
  },
});

// ============================================================================
// INTERNET SEARCH APPROVAL UI
// ============================================================================

type InternetSearchArgs = {
  query: string;
  maxResults?: number;
};

type InternetSearchResult = {
  approve?: boolean;
  edit?: boolean;
  reject?: boolean;
  error?: string;
  success?: boolean;
};

export const InternetSearchToolUI = makeAssistantToolUI<
  InternetSearchArgs,
  string
>({
  toolName: 'internet_search',
  render: function InternetSearchUI({ args, result, status, addResult }) {
    let resultObj: InternetSearchResult = {};
    try {
      resultObj = result ? JSON.parse(result) : {};
    } catch {
      resultObj = { error: result || 'Unknown error' };
    }

    const handleApprove = () => {
      addResult(JSON.stringify({ approve: true }));
    };

    const handleReject = () => {
      addResult(JSON.stringify({ reject: true }));
    };

    const handleEdit = () => {
      addResult(JSON.stringify({ edit: true }));
    };

    const isPending = !result && status.type !== 'running';
    const isRunning = status.type === 'running';
    const wasApproved = resultObj.approve === true;
    const wasRejected =
      resultObj.reject === true || resultObj.approve === false;
    const wasEdited = resultObj.edit === true;

    return (
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader
          className={cn(
            'pb-3',
            wasApproved && 'bg-status-success-muted',
            wasRejected && 'bg-status-error-muted',
          )}
        >
          <div className="flex items-center gap-2">
            {wasApproved && (
              <CheckCircle className="h-5 w-5 text-status-success" />
            )}
            {wasRejected && <XCircle className="h-5 w-5 text-status-error" />}
            {!wasApproved && !wasRejected && (
              <Search className="h-5 w-5 text-status-info" />
            )}
            <CardTitle className="text-base font-semibold">
              {wasApproved
                ? 'Search Completed'
                : wasRejected
                  ? 'Search Cancelled'
                  : 'Internet Search'}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          {/* Search Query */}
          <div className="rounded-lg border bg-background p-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Search Query
            </span>
            <p className="mt-2 text-sm whitespace-pre-wrap">{args.query}</p>
          </div>

          {/* Max Results */}
          {args.maxResults && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Max Results</span>
              <Badge variant="secondary">{args.maxResults}</Badge>
            </div>
          )}

          {/* Status Messages */}
          {isRunning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching...</span>
            </div>
          )}

          {wasEdited && (
            <p className="text-sm text-muted-foreground">
              Edit requested - please provide updated search query.
            </p>
          )}
        </CardContent>

        {/* Action Buttons - only show when pending */}
        {isPending && (
          <CardFooter className="border-t bg-muted/30 pt-4">
            <ApprovalActions
              actions={[
                {
                  id: 'reject',
                  label: 'Cancel',
                  variant: 'ghost',
                  icon: <XCircle className="mr-1.5 h-4 w-4" />,
                },
                {
                  id: 'edit',
                  label: 'Edit',
                  variant: 'outline',
                  icon: <Edit2 className="mr-1.5 h-4 w-4" />,
                },
                {
                  id: 'approve',
                  label: 'Search',
                  variant: 'default',
                  confirmLabel: 'Confirm Search',
                  icon: <Search className="mr-1.5 h-4 w-4" />,
                },
              ]}
              onAction={(id) => {
                if (id === 'approve') handleApprove();
                if (id === 'reject') handleReject();
                if (id === 'edit') handleEdit();
              }}
            />
          </CardFooter>
        )}
      </Card>
    );
  },
});
