'use client';

/**
 * Search Memories Tool UI
 *
 * Displays memory search results in a DataTable with proper formatting.
 */

import { useState, useEffect } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { DataTable, DataTableErrorBoundary } from '../data-table/data-table';
import { Column } from '../data-table/types';

// ============================================================================
// Types
// ============================================================================

type SearchMemoriesArgs = {
  query: string;
  limit?: number;
  categories?: string[];
};

type MemoryRow = {
  id: string;
  content: string;
  category: string;
  importance: number;
  timestamp: string;
};

type SearchMemoriesResult = {
  memories: MemoryRow[];
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
    try {
      resultObj = result ? JSON.parse(result) : undefined;
    } catch {
      resultObj = undefined;
    }

    const memories = resultObj?.memories || [];
    const hasResults = memories.length > 0;

    // Convert importance to string for status mapping
    const formattedMemories = memories.map((m) => ({
      ...m,
      importance: String(m.importance),
    }));

    const isRunning = status.type === 'running';

    return (
      <Card className="w-full min-w-[400px] max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">
              {isRunning
                ? 'Searching memories...'
                : `Found ${memories.length} memories`}
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Query: &quot;{args.query}&quot;
            {args.categories && args.categories.length > 0 && (
              <span className="ml-2">in {args.categories.join(', ')}</span>
            )}
          </p>
        </CardHeader>

        <CardContent className="pt-0">
          {isRunning && !showContent && (
            <ThinkingLoader message="Searching memories..." />
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

          {showContent && !hasResults && !isRunning && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No memories found matching your query.
            </p>
          )}
        </CardContent>
      </Card>
    );
  },
});
