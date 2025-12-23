/**
 * Job Status UI Component
 *
 * Displays background job status with progress indicators.
 * Can be used in the sidebar or as a floating indicator.
 */

'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { BackgroundJob, JobPhase } from '../lib/chatApi';
import {
  useJobStatus,
  getJobTypeLabel,
  getJobStatusColor,
  formatRelativeTime,
} from '../lib/use-job-status';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// STATUS ICON
// ============================================================================

function JobStatusIcon({ status }: { status: BackgroundJob['status'] }) {
  switch (status) {
    case 'pending':
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'cancelled':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    default:
      return <Circle className="h-4 w-4" />;
  }
}

// ============================================================================
// JOB ITEM
// ============================================================================

interface JobItemProps {
  job: BackgroundJob;
  expanded?: boolean;
  onToggle?: () => void;
}

function JobItem({ job, expanded, onToggle }: JobItemProps) {
  return (
    <div className="rounded-lg border bg-card p-3">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <JobStatusIcon status={job.status} />
          <span className="font-medium text-sm">
            {getJobTypeLabel(job.type)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn('text-xs', getJobStatusColor(job.status))}
          >
            {job.status}
          </Badge>
          {onToggle &&
            (expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ))}
        </div>
      </div>

      {/* Progress */}
      {(job.status === 'running' || job.status === 'pending') && (
        <div className="mt-2">
          <Progress value={job.progress} className="h-1.5" />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {job.currentPhase || 'Starting...'}
            </span>
            <span className="text-xs text-muted-foreground">
              {job.progress}%
            </span>
          </div>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          {/* Time info */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Created</span>
            <span>{formatRelativeTime(job.createdAt)}</span>
          </div>
          {job.startedAt && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Started</span>
              <span>{formatRelativeTime(job.startedAt)}</span>
            </div>
          )}
          {job.completedAt && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Completed</span>
              <span>{formatRelativeTime(job.completedAt)}</span>
            </div>
          )}

          {/* Error */}
          {job.error && (
            <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">
              {job.error}
            </div>
          )}

          {/* Phases */}
          {job.phases.length > 0 && (
            <div className="mt-2 space-y-1">
              <span className="text-xs font-medium">Phases</span>
              {job.phases.map((phase) => (
                <div
                  key={phase.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <JobStatusIcon status={phase.status} />
                    <span
                      className={cn(
                        phase.status === 'completed' &&
                          'text-muted-foreground line-through',
                      )}
                    >
                      {phase.name}
                    </span>
                  </div>
                  {phase.completedAt && (
                    <span className="text-muted-foreground">
                      {formatRelativeTime(phase.completedAt)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// JOB STATUS PANEL
// ============================================================================

interface JobStatusPanelProps {
  workspaceId: string;
  className?: string;
  maxVisible?: number;
  showCompleted?: boolean;
}

export function JobStatusPanel({
  workspaceId,
  className,
  maxVisible = 3,
  showCompleted = true,
}: JobStatusPanelProps) {
  const { jobs, activeJobs, isLoading, error, refresh } = useJobStatus({
    workspaceId,
    pollInterval: 3000,
  });

  const [expandedJobId, setExpandedJobId] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  // Filter jobs based on settings
  const displayJobs = React.useMemo(() => {
    let filtered = showCompleted ? jobs : activeJobs;
    if (!showAll) {
      filtered = filtered.slice(0, maxVisible);
    }
    return filtered;
  }, [jobs, activeJobs, showCompleted, showAll, maxVisible]);

  const hasMore = (showCompleted ? jobs : activeJobs).length > maxVisible;

  if (isLoading && jobs.length === 0) {
    return (
      <div className={cn('flex items-center justify-center p-4', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 text-center', className)}>
        <XCircle className="h-5 w-5 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={refresh}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return null; // No jobs, don't show panel
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Background Jobs</h3>
          {activeJobs.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeJobs.length} active
            </Badge>
          )}
        </div>
        <button
          onClick={refresh}
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Job list */}
      <div className="space-y-2">
        {displayJobs.map((job) => (
          <JobItem
            key={job.id}
            job={job}
            expanded={expandedJobId === job.id}
            onToggle={() =>
              setExpandedJobId(expandedJobId === job.id ? null : job.id)
            }
          />
        ))}
      </div>

      {/* Show more/less */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1"
        >
          {showAll
            ? 'Show less'
            : `Show ${(showCompleted ? jobs : activeJobs).length - maxVisible} more`}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// FLOATING INDICATOR
// ============================================================================

interface JobFloatingIndicatorProps {
  workspaceId: string;
  className?: string;
}

/**
 * A small floating indicator that shows when there are active jobs.
 * Click to expand into a full panel.
 */
export function JobFloatingIndicator({
  workspaceId,
  className,
}: JobFloatingIndicatorProps) {
  const { activeJobs, isLoading } = useJobStatus({
    workspaceId,
    pollInterval: 2000,
  });

  const [expanded, setExpanded] = React.useState(false);

  if (isLoading || activeJobs.length === 0) {
    return null;
  }

  return (
    <div className={cn('fixed bottom-4 right-4 z-50', className)}>
      {expanded ? (
        <div className="w-80 max-h-96 overflow-auto rounded-lg border bg-card shadow-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-sm">Active Jobs</h3>
            <button
              onClick={() => setExpanded(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {activeJobs.map((job) => (
              <JobItem key={job.id} job={job} />
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">
            {activeJobs.length} job{activeJobs.length > 1 ? 's' : ''} running
          </span>
        </button>
      )}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { JobItem, JobStatusIcon };
