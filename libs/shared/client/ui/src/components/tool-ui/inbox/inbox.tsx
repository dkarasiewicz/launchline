'use client';

/**
 * Get Inbox Items Tool UI
 *
 * Displays inbox items in a DataTable with proper formatting.
 */

import { useState, useEffect } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { DataTable, DataTableErrorBoundary } from '../data-table/data-table';
import { Column } from '../data-table/types';

// ============================================================================
// Types
// ============================================================================

type GetInboxItemsArgs = {
  priority?: 'critical' | 'high' | 'medium' | 'low';
  type?: 'blocker' | 'stalled_pr' | 'priority_drift' | 'update_needed';
  limit?: number;
};

type InboxItemRow = {
  id: string;
  type: string;
  priority: string;
  title: string;
  summary: string;
  createdAt: string;
};

type GetInboxItemsResult = {
  items: InboxItemRow[];
};

// ============================================================================
// Column Configuration
// ============================================================================

const inboxColumns: Column<InboxItemRow>[] = [
  {
    key: 'title',
    label: 'Item',
    priority: 'primary',
    truncate: true,
  },
  {
    key: 'type',
    label: 'Type',
    format: {
      kind: 'status',
      statusMap: {
        blocker: { tone: 'danger', label: '🚫 Blocker' },
        stalled_pr: { tone: 'warning', label: '⏸️ Stalled PR' },
        priority_drift: { tone: 'info', label: '📉 Priority Drift' },
        update_needed: { tone: 'neutral', label: '📝 Update Needed' },
      },
    },
  },
  {
    key: 'priority',
    label: 'Priority',
    format: {
      kind: 'status',
      statusMap: {
        critical: { tone: 'danger', label: 'Critical' },
        high: { tone: 'warning', label: 'High' },
        medium: { tone: 'info', label: 'Medium' },
        low: { tone: 'success', label: 'Low' },
      },
    },
  },
  {
    key: 'createdAt',
    label: 'Created',
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
// Get Inbox Items Tool UI
// ============================================================================

export const GetInboxItemsToolUI = makeAssistantToolUI<
  GetInboxItemsArgs,
  string
>({
  toolName: 'get_inbox_items',
  render: function GetInboxItemsUI({ args, result, status }) {
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

    let resultObj: GetInboxItemsResult | undefined;
    try {
      resultObj = result ? JSON.parse(result) : undefined;
    } catch {
      resultObj = undefined;
    }

    const items = resultObj?.items || [];
    const hasItems = items.length > 0;
    const isRunning = status.type === 'running';

    return (
      <Card className="w-full min-w-[400px] max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Loading inbox...' : `Found ${items.length} items`}
            </CardTitle>
          </div>
          {(args.priority || args.type) && (
            <div className="flex gap-2 mt-1">
              {args.priority && (
                <Badge variant="secondary" className="text-xs">
                  {args.priority} priority
                </Badge>
              )}
              {args.type && (
                <Badge variant="outline" className="text-xs">
                  {args.type.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {isRunning && !showContent && (
            <ThinkingLoader message="Fetching inbox items..." />
          )}

          {showContent && hasItems && (
            <DataTableErrorBoundary>
              <DataTable
                rowIdKey="id"
                columns={inboxColumns as Column<Record<string, unknown>>[]}
                data={items}
                defaultSort={{ by: 'createdAt', direction: 'desc' }}
              />
            </DataTableErrorBoundary>
          )}

          {showContent && !hasItems && !isRunning && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No inbox items found.
            </p>
          )}
        </CardContent>
      </Card>
    );
  },
});
