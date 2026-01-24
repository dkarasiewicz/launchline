'use client';

/**
 * Memory Tool UIs
 *
 * UI components for memory-related tools.
 */

import { useState, useEffect } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import {
  Brain,
  AlertTriangle,
  Lightbulb,
  User,
  Save,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { DataTable, DataTableErrorBoundary } from '../data-table/data-table';
import { Column } from '../data-table/types';
import { cn } from '../../../lib/utils';

// ============================================================================
// Types
// ============================================================================

type SearchMemoriesArgs = {
  query: string;
  limit?: number;
  namespace?: string;
};

type MemoryRow = {
  id: string;
  content: string;
  category: string;
  namespace: string;
  importance: number;
  timestamp: string;
};

type SearchMemoriesResult = {
  memories: MemoryRow[];
  error?: string;
};

// ============================================================================
// Column Configuration
// ============================================================================

const memoryColumns: Column<MemoryRow>[] = [
  {
    key: 'content',
    label: 'Memory',
    priority: 'primary',
    truncate: true,
  },
  {
    key: 'namespace',
    label: 'Scope',
    format: {
      kind: 'badge',
      colorMap: {
        workspace: 'info',
        team: 'success',
        product: 'warning',
        project: 'info',
        decision: 'success',
        blocker: 'danger',
      },
    },
  },
  {
    key: 'category',
    label: 'Category',
    format: {
      kind: 'badge',
      colorMap: {
        github: 'info',
        linear: 'success',
        slack: 'warning',
        team: 'neutral',
        product: 'info',
        decision: 'success',
        code: 'info',
        architecture: 'warning',
      },
    },
  },
  {
    key: 'importance',
    label: 'Importance',
    align: 'center',
    format: {
      kind: 'status',
      statusMap: {
        '5': { tone: 'danger', label: 'Critical' },
        '4': { tone: 'warning', label: 'High' },
        '3': { tone: 'info', label: 'Medium' },
        '2': { tone: 'neutral', label: 'Low' },
        '1': { tone: 'neutral', label: 'Minimal' },
      },
    },
  },
  {
    key: 'timestamp',
    label: 'Date',
    format: { kind: 'date', dateFormat: 'relative' },
  },
];

// ============================================================================
// Loading Component with Delay
// ============================================================================

function ThinkingLoader({
  message,
  delayMs = 300,
}: {
  message: string;
  delayMs?: number;
}) {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!showLoader) return null;

  return (
    <div className="flex items-center gap-2 text-muted-foreground py-3">
      <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

// ============================================================================
// Search Memories Tool UI
// ============================================================================

export const SearchMemoriesToolUI = makeAssistantToolUI<
  SearchMemoriesArgs,
  string
>({
  toolName: 'search_memories',
  render: function SearchMemoriesUI({ args, result, status }) {
    const [showContent, setShowContent] = useState(false);

    // Only show content after delay when running
    useEffect(() => {
      if (status.type === 'running') {
        setShowContent(false);
        const timer = setTimeout(() => setShowContent(true), 300);
        return () => clearTimeout(timer);
      } else {
        setShowContent(true);
      }
    }, [status.type]);

    let resultObj: SearchMemoriesResult | undefined;
    let rawText: string | undefined;
    try {
      resultObj = result ? JSON.parse(result) : undefined;
    } catch {
      rawText = result || undefined;
      resultObj = undefined;
    }

    const memories = resultObj?.memories || [];
    const errorMessage = resultObj?.error;
    const hasResults = memories.length > 0;

    // Convert importance to string for status mapping
    const formattedMemories = memories.map((m) => ({
      ...m,
      importance: String(
        Math.min(5, Math.max(1, Math.round((m.importance || 0) * 5))),
      ),
    }));

    const isRunning = status.type === 'running';
    const hasError = Boolean(errorMessage);
    const topMemory = memories[0];

    return (
      <Card className="w-full min-w-[400px] max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">
              {isRunning
                ? 'Searching memories...'
                : hasError
                  ? 'Memory search failed'
                  : `Found ${memories.length} memories`}
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Query: &quot;{args.query}&quot;
            {args.namespace && (
              <span className="ml-2">in {args.namespace}</span>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[11px]">
              Scope: {args.namespace ?? 'all'}
            </Badge>
            {typeof args.limit === 'number' && (
              <Badge variant="outline" className="text-[11px]">
                Limit: {args.limit}
              </Badge>
            )}
            {!isRunning && !hasError && (
              <Badge variant="secondary" className="text-[11px]">
                Results: {memories.length}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {isRunning && !showContent && (
            <ThinkingLoader message="Searching memories..." />
          )}

          {showContent && hasError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{errorMessage}</span>
            </div>
          )}

          {showContent && !hasError && topMemory && (
            <div className="mb-3 rounded-lg border border-border/40 bg-background/70 p-3 text-sm">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="uppercase tracking-widest">Most relevant</span>
                <Badge variant="outline" className="text-[11px] capitalize">
                  {topMemory.namespace}
                </Badge>
              </div>
              <p className="mt-2 font-medium text-foreground">
                {topMemory.content}
              </p>
            </div>
          )}

          {showContent && hasResults && (
            <DataTableErrorBoundary>
              <DataTable
                rowIdKey="id"
                columns={memoryColumns as Column<Record<string, unknown>>[]}
                data={formattedMemories}
                defaultSort={{ by: 'timestamp', direction: 'desc' }}
              />
            </DataTableErrorBoundary>
          )}

          {showContent && !hasResults && !isRunning && !hasError && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {rawText || 'No memories found matching your query.'}
            </p>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// SAVE MEMORY TOOL UI
// ============================================================================

type SaveMemoryArgs = {
  content: string;
  summary: string;
  namespace: string;
  category: string;
  importance?: number;
  entityId?: string;
};

export const SaveMemoryToolUI = makeAssistantToolUI<SaveMemoryArgs, string>({
  toolName: 'save_memory',
  render: function SaveMemoryUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isSuccess = result?.includes('successfully');

    return (
      <Card className="w-full max-w-md overflow-hidden my-2">
        <CardHeader className={cn('pb-3', isSuccess && 'bg-green-500/10')}>
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Save className="h-4 w-4 text-primary" />
            )}
            <CardTitle className="text-sm font-medium">
              {isRunning
                ? 'Saving memory...'
                : isSuccess
                  ? 'Memory Saved'
                  : 'Save Memory'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="flex gap-2">
            <Badge variant="outline">{args.namespace}</Badge>
            <Badge variant="secondary">{args.category}</Badge>
            {args.importance && (
              <Badge variant="secondary">Importance: {args.importance}</Badge>
            )}
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground mb-1">Summary</p>
            <p className="text-sm">{args.summary}</p>
          </div>
          {result && (
            <p
              className={cn(
                'text-xs',
                isSuccess ? 'text-green-600' : 'text-muted-foreground',
              )}
            >
              {result}
            </p>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// GET BLOCKERS TOOL UI
// ============================================================================

type GetBlockersArgs = {
  limit?: number;
};

export const GetBlockersToolUI = makeAssistantToolUI<GetBlockersArgs, string>({
  toolName: 'get_blockers',
  render: function GetBlockersUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isEmpty = result === 'No active blockers found.';

    return (
      <Card className="w-full max-w-lg overflow-hidden my-2">
        <CardHeader className="pb-3 bg-rose-500/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Finding blockers...' : 'Active Blockers'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message="Searching for blockers..." />
          ) : isEmpty ? (
            <div className="flex items-center gap-2 text-green-600 py-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">No active blockers found!</span>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap">{result}</div>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// GET DECISIONS TOOL UI
// ============================================================================

type GetDecisionsArgs = {
  limit?: number;
};

export const GetDecisionsToolUI = makeAssistantToolUI<GetDecisionsArgs, string>(
  {
    toolName: 'get_decisions',
    render: function GetDecisionsUI({ args, result, status }) {
      const isRunning = status.type === 'running';
      const isEmpty = result === 'No recent decisions found.';

      return (
        <Card className="w-full max-w-lg overflow-hidden my-2">
          <CardHeader className="pb-3 bg-emerald-500/5">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-sm font-medium">
                {isRunning ? 'Finding decisions...' : 'Recent Decisions'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isRunning ? (
              <ThinkingLoader message="Searching for decisions..." />
            ) : isEmpty ? (
              <p className="text-sm text-muted-foreground py-2">
                No recent decisions found.
              </p>
            ) : (
              <div className="text-sm whitespace-pre-wrap">{result}</div>
            )}
          </CardContent>
        </Card>
      );
    },
  },
);

// ============================================================================
// RESOLVE IDENTITY TOOL UI
// ============================================================================

type ResolveIdentityArgs = {
  name: string;
};

export const ResolveIdentityToolUI = makeAssistantToolUI<
  ResolveIdentityArgs,
  string
>({
  toolName: 'resolve_identity',
  render: function ResolveIdentityUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const notFound = result?.includes('No linked identity found');

    return (
      <Card className="w-full max-w-md overflow-hidden my-2">
        <CardHeader className="pb-3 bg-blue-500/5">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Resolving identity...' : `Identity: ${args.name}`}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message={`Looking up ${args.name}...`} />
          ) : notFound ? (
            <p className="text-sm text-muted-foreground">{result}</p>
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
