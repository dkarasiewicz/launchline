'use client';

/**
 * Generate Project Update Tool UI
 *
 * Displays project update generation with stats table and content preview.
 */

import { useState, useEffect } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { DataTable, DataTableErrorBoundary } from '../data-table/data-table';
import { Column } from '../data-table/types';

// ============================================================================
// Types
// ============================================================================

type GenerateProjectUpdateArgs = {
  projectId?: string;
  timeRange?: string;
  format?: string;
  audience?: string;
};

type GenerateProjectUpdateResult = {
  workspaceId?: string;
  projectId?: string;
  timeRange?: string;
  format?: string;
  audience?: string;
  update?: string;
  sections?: string[];
  note?: string;
  stats?: {
    prsOpened?: number;
    prsMerged?: number;
    ticketsClosed?: number;
    blockers?: number;
  };
};

type StatRow = {
  id: string;
  metric: string;
  value: number;
  status: string;
};

// ============================================================================
// Column Configuration
// ============================================================================

const statsColumns: Column<StatRow>[] = [
  {
    key: 'metric',
    label: 'Metric',
    priority: 'primary',
  },
  {
    key: 'value',
    label: 'Count',
    align: 'right',
    format: { kind: 'number', decimals: 0 },
  },
  {
    key: 'status',
    label: 'Status',
    format: {
      kind: 'status',
      statusMap: {
        good: { tone: 'success', label: 'Good' },
        warning: { tone: 'warning', label: 'Attention' },
        critical: { tone: 'danger', label: 'Critical' },
        neutral: { tone: 'neutral', label: 'Neutral' },
      },
    },
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
// Generate Project Update Tool UI
// ============================================================================

export const GenerateProjectUpdateToolUI = makeAssistantToolUI<
  GenerateProjectUpdateArgs,
  string
>({
  toolName: 'generate_project_update',
  render: function GenerateProjectUpdateUI({ args, result, status }) {
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

    let resultObj: GenerateProjectUpdateResult | undefined;
    try {
      resultObj = result ? JSON.parse(result) : undefined;
    } catch {
      resultObj = undefined;
    }

    const isRunning = status.type === 'running';

    // Convert stats to table format if available
    const statsData: StatRow[] = resultObj?.stats
      ? [
          {
            id: 'prs-opened',
            metric: 'PRs Opened',
            value: resultObj.stats.prsOpened ?? 0,
            status: 'neutral',
          },
          {
            id: 'prs-merged',
            metric: 'PRs Merged',
            value: resultObj.stats.prsMerged ?? 0,
            status: 'good',
          },
          {
            id: 'tickets-closed',
            metric: 'Tickets Closed',
            value: resultObj.stats.ticketsClosed ?? 0,
            status: 'good',
          },
          {
            id: 'blockers',
            metric: 'Blockers',
            value: resultObj.stats.blockers ?? 0,
            status: (resultObj.stats.blockers ?? 0) > 0 ? 'critical' : 'good',
          },
        ]
      : [];

    return (
      <Card className="w-full min-w-[400px] max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">
                {isRunning ? 'Generating update...' : 'Project Update'}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {args.timeRange || 'Weekly'} update for {args.audience || 'team'} (
              {args.format || 'slack'})
            </p>
          </div>
          {isRunning && !showContent && (
            <ThinkingLoader message="Generating update..." />
          )}

          {showContent && resultObj && (
            <>
              {/* Stats Table */}
              {statsData.length > 0 && (
                <DataTableErrorBoundary>
                  <DataTable
                    rowIdKey="id"
                    columns={statsColumns as Column<Record<string, unknown>>[]}
                    data={statsData}
                  />
                </DataTableErrorBoundary>
              )}

              {/* Sections preview */}
              {resultObj.sections && resultObj.sections.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {resultObj.sections.map((section, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {section}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Update content */}
              {resultObj.update && (
                <div className="rounded-lg bg-muted p-3">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {resultObj.update}
                  </pre>
                </div>
              )}

              {/* Note */}
              {resultObj.note && (
                <p className="text-xs text-muted-foreground italic">
                  {resultObj.note}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  },
});
