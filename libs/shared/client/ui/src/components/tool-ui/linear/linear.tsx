'use client';

/**
 * Linear Tool UIs
 *
 * UI components for Linear integration tools.
 * These display real-time data fetched from Linear.
 */

import { useState, useEffect } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  Loader2,
  AlertTriangle,
  Search,
  Users,
  Target,
  CalendarDays,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function LinearLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className}>
      <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228ZM.00189135 46.8891c-.01764375.2833.08887215.5599.28957165.7606L52.3503 99.7085c.2007.2007.4773.3072.7606.2896 15.8807-.9833 30.0585-9.2913 37.4814-22.9274.3013-.5536.0742-1.2561-.4913-1.5446L1.54623 9.51455c-.5765-.29373-1.29721.00803-1.57469.59185C-2.63609 16.4667-1.70172 32.1274.00189 46.8891ZM52.3503.291054c-.2833-.01764375-.5599.088872-.7606.289572L.289562 51.8907c-.200699.2007-.307194.4773-.289552.7607.973312 15.8807 9.291272 30.0585 22.92737 37.4814.55366.3012 1.25614.0742 1.54463-.4913L89.4351 1.54628c.2937-.57646-.008-1.29718-.5765-1.574692C82.5463-2.63605 66.8856-1.70168 52.3503.291054ZM99.7078 52.3479c.1764-.2833-.0891-.5599-.2896-.7606L60.9554 13.1245c-.6889-.68886-1.8189-.09154-1.5765.857 4.3024 18.4258 18.806 32.9295 37.2318 37.2318.9485.2225 1.5459-.90748.857-1.5765Z" />
    </svg>
  );
}

function ThinkingLoader({ message }: { message: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(timer);
  }, []);
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-3">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

// ============================================================================
// GET LINEAR ISSUES
// ============================================================================

type GetLinearIssuesArgs = {
  filter: 'my_issues' | 'team_issues' | 'blockers' | 'stalled' | 'recent';
  teamId?: string;
  limit?: number;
};

export const GetLinearIssuesToolUI = makeAssistantToolUI<
  GetLinearIssuesArgs,
  string
>({
  toolName: 'get_linear_issues',
  render: function GetLinearIssuesUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');

    const filterLabels: Record<string, string> = {
      my_issues: 'My Issues',
      team_issues: 'Team Issues',
      blockers: 'Blockers',
      stalled: 'Stalled (7+ days)',
      recent: 'Recent',
    };

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3 bg-violet-500/5">
          <div className="flex items-center gap-2">
            <LinearLogo className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Fetching issues...' : 'Linear Issues'}
            </CardTitle>
            <Badge variant="secondary" className="ml-auto text-xs">
              {filterLabels[args.filter] || args.filter}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message="Fetching issues from Linear..." />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
              {result}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// GET LINEAR ISSUE DETAILS
// ============================================================================

type GetLinearIssueDetailsArgs = {
  issueId: string;
};

export const GetLinearIssueDetailsToolUI = makeAssistantToolUI<
  GetLinearIssueDetailsArgs,
  string
>({
  toolName: 'get_linear_issue_details',
  render: function GetLinearIssueDetailsUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3 bg-violet-500/5">
          <div className="flex items-center gap-2">
            <LinearLogo className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Loading issue...' : `Issue: ${args.issueId}`}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message={`Loading ${args.issueId}...`} />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
              {result}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// SEARCH LINEAR ISSUES
// ============================================================================

type SearchLinearIssuesArgs = {
  query: string;
  includeArchived?: boolean;
  limit?: number;
};

export const SearchLinearIssuesToolUI = makeAssistantToolUI<
  SearchLinearIssuesArgs,
  string
>({
  toolName: 'search_linear_issues',
  render: function SearchLinearIssuesUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3 bg-violet-500/5">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Searching...' : 'Search Results'}
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Query: &quot;{args.query}&quot;
            {args.includeArchived && ' (including archived)'}
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message={`Searching for "${args.query}"...`} />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
              {result}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// GET LINEAR PROJECT STATUS
// ============================================================================

type GetLinearProjectStatusArgs = {
  projectId?: string;
  includeCompleted?: boolean;
};

export const GetLinearProjectStatusToolUI = makeAssistantToolUI<
  GetLinearProjectStatusArgs,
  string
>({
  toolName: 'get_linear_project_status',
  render: function GetLinearProjectStatusUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3 bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Loading projects...' : 'Project Status'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message="Fetching project status..." />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
              {result}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// GET LINEAR TEAM WORKLOAD
// ============================================================================

type GetLinearTeamWorkloadArgs = {
  teamId?: string;
  includeUnassigned?: boolean;
};

export const GetLinearTeamWorkloadToolUI = makeAssistantToolUI<
  GetLinearTeamWorkloadArgs,
  string
>({
  toolName: 'get_linear_team_workload',
  render: function GetLinearTeamWorkloadUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3 bg-blue-500/5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Loading workload...' : 'Team Workload'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message="Analyzing team workload..." />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
              {result}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// GET LINEAR CYCLE STATUS
// ============================================================================

type GetLinearCycleStatusArgs = {
  cycleId?: string;
  teamId?: string;
};

export const GetLinearCycleStatusToolUI = makeAssistantToolUI<
  GetLinearCycleStatusArgs,
  string
>({
  toolName: 'get_linear_cycle_status',
  render: function GetLinearCycleStatusUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3 bg-amber-500/5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Loading cycle...' : 'Cycle Status'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message="Fetching cycle status..." />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
              {result}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// ADD LINEAR COMMENT
// ============================================================================

type AddLinearCommentArgs = {
  issueId: string;
  body: string;
};

export const AddLinearCommentToolUI = makeAssistantToolUI<
  AddLinearCommentArgs,
  string
>({
  toolName: 'add_linear_comment',
  render: function AddLinearCommentUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isSuccess = result?.startsWith('✅');
    const isError = result?.startsWith('❌') || result?.startsWith('Error');

    return (
      <Card className="w-full max-w-md overflow-hidden my-2">
        <CardHeader
          className={cn(
            'pb-3',
            isSuccess && 'bg-green-500/10',
            isError && 'bg-destructive/10',
          )}
        >
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : isError ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <MessageSquare className="h-4 w-4 text-violet-500" />
            )}
            <CardTitle className="text-sm font-medium">
              {isRunning
                ? 'Adding comment...'
                : isSuccess
                  ? 'Comment Added'
                  : isError
                    ? 'Failed'
                    : 'Add Comment'}
            </CardTitle>
            <Badge variant="outline" className="ml-auto text-xs font-mono">
              {args.issueId}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message="Adding comment..." />
          ) : (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 mb-3">
                <p className="text-xs text-muted-foreground mb-1">Comment</p>
                <p className="text-sm">
                  {args.body.slice(0, 200)}
                  {args.body.length > 200 ? '...' : ''}
                </p>
              </div>
              {result && (
                <p
                  className={cn(
                    'text-sm',
                    isSuccess && 'text-green-600',
                    isError && 'text-destructive',
                  )}
                >
                  {result}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  },
});
