/**
 * Background Job Status Hook
 *
 * React hook for subscribing to and displaying background job status.
 * Uses the status-sync graph to get real-time updates.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  BackgroundJob, 
  JobUpdate, 
  JobStatus,
  getJobs, 
  getJobById, 
} from "./chatApi";

// Re-export types for convenience
export type { BackgroundJob, JobUpdate, JobStatus } from "./chatApi";

// ============================================================================
// TYPES
// ============================================================================

export interface JobStatusState {
  jobs: BackgroundJob[];
  activeJobs: BackgroundJob[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

export interface UseJobStatusOptions {
  workspaceId: string;
  pollInterval?: number; // Polling interval in ms (default: 5000)
  enablePolling?: boolean; // Enable polling (default: true)
  enableStreaming?: boolean; // Enable streaming (default: false, for future use)
}

// ============================================================================
// HOOK
// ============================================================================

export function useJobStatus(options: UseJobStatusOptions): JobStatusState & {
  refresh: () => Promise<void>;
  getJob: (jobId: string) => Promise<BackgroundJob | null>;
} {
  const { workspaceId, pollInterval = 5000, enablePolling = true } = options;

  const [state, setState] = useState<JobStatusState>({
    jobs: [],
    activeJobs: [],
    isLoading: true,
    error: null,
    lastUpdate: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    try {
      const jobs = await getJobs(workspaceId);
      const activeJobs = jobs.filter(
        (j) => j.status === "running" || j.status === "pending"
      );

      setState((prev) => ({
        ...prev,
        jobs,
        activeJobs,
        isLoading: false,
        error: null,
        lastUpdate: new Date(),
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to fetch jobs",
      }));
    }
  }, [workspaceId]);

  // Get a specific job
  const getJob = useCallback(
    async (jobId: string): Promise<BackgroundJob | null> => {
      try {
        return await getJobById(workspaceId, jobId);
      } catch (error) {
        console.error("Failed to get job:", error);
        return null;
      }
    },
    [workspaceId]
  );

  // Refresh
  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    await fetchJobs();
  }, [fetchJobs]);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Polling
  useEffect(() => {
    if (!enablePolling) return;

    const interval = setInterval(fetchJobs, pollInterval);

    return () => {
      clearInterval(interval);
    };
  }, [enablePolling, pollInterval, fetchJobs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    refresh,
    getJob,
  };
}

// ============================================================================
// JOB UPDATE LISTENER
// ============================================================================

/**
 * Hook to listen for job updates from the graph
 *
 * This can be used with assistant-ui's custom event system
 */
export function useJobUpdateListener(
  onUpdate: (update: JobUpdate) => void,
  onJobsList?: (jobs: BackgroundJob[]) => void
) {
  useEffect(() => {
    // This would integrate with assistant-ui's useAssistantEvent
    // For now, we'll provide the interface for future implementation
    
    // Example integration:
    // useAssistantEvent("*", (event) => {
    //   if (event.type === "job_update") {
    //     onUpdate(event.data as JobUpdate);
    //   }
    //   if (event.type === "jobs_list") {
    //     onJobsList?.(event.data.jobs);
    //   }
    // });
    
    console.log("[useJobUpdateListener] Listener registered");
    
    return () => {
      console.log("[useJobUpdateListener] Listener unregistered");
    };
  }, [onUpdate, onJobsList]);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get a human-readable label for job type
 */
export function getJobTypeLabel(type: BackgroundJob["type"]): string {
  const labels: Record<BackgroundJob["type"], string> = {
    linear_onboarding: "Linear Setup",
    github_onboarding: "GitHub Setup",
    slack_onboarding: "Slack Setup",
    identity_linking: "Identity Linking",
    signal_ingestion: "Signal Processing",
  };
  return labels[type] || type;
}

/**
 * Get status color classes
 */
export function getJobStatusColor(status: BackgroundJob["status"]): string {
  const colors: Record<BackgroundJob["status"], string> = {
    pending: "text-muted-foreground bg-muted",
    running: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30",
    completed: "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30",
    failed: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30",
    cancelled: "text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30",
  };
  return colors[status] || "";
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}
