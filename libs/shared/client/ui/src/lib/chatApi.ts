/**
 * Launchline Chat API - LangGraph SDK integration
 *
 * This module provides helper functions for interacting with
 * the Linea LangGraph agent via the LangGraph SDK.
 * 
 * Following the assistant-ui LangGraph integration guide:
 * https://www.assistant-ui.com/docs/runtimes/langgraph
 */

import { Client, ThreadState } from "@langchain/langgraph-sdk";
import { LangChainMessage } from "@assistant-ui/react-langgraph";

// ============================================================================
// TYPES
// ============================================================================

export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface JobPhase {
  name: string;
  status: JobStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  progress?: number;
  metadata?: Record<string, unknown>;
}

export interface BackgroundJob {
  id: string;
  type: "linear_onboarding" | "github_onboarding" | "slack_onboarding" | "identity_linking" | "signal_ingestion";
  workspaceId: string;
  userId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  phases: JobPhase[];
  currentPhase?: string;
  progress: number;
  result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface JobUpdate {
  jobId: string;
  type: "status_change" | "phase_start" | "phase_complete" | "progress" | "error" | "complete";
  status?: JobStatus;
  phase?: string;
  progress?: number;
  message?: string;
  error?: string;
  result?: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// CLIENT
// ============================================================================

const createClient = () => {
  const apiUrl = process.env["NEXT_PUBLIC_LANGGRAPH_API_URL"] || "/api";

  return new Client({
    apiUrl,
  });
};

// ============================================================================
// THREAD MANAGEMENT
// ============================================================================

export const createThread = async () => {
  const client = createClient();

  return client.threads.create();
};

export const getThreadState = async (
  threadId: string,
): Promise<ThreadState<{ messages: LangChainMessage[] }>> => {
  const client = createClient();
  return client.threads.getState(threadId);
};

export const sendMessage = async (params: {
  threadId: string;
  messages: LangChainMessage[];
  context?: Record<string, unknown>;
}) => {
  const client = createClient();
  return client.runs.stream(
    params.threadId,
    process.env["NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID"]!,
    {
      input: {
        messages: params.messages,
      },
        context: params.context,
      streamMode: "messages",
    },
  );
};

// ============================================================================
// JOB STATUS API
// ============================================================================

/**
 * Get all background jobs for a workspace
 */
export const getJobs = async (workspaceId: string): Promise<BackgroundJob[]> => {
  const client = createClient();
  
  // Use the status-sync graph to get jobs
  const thread = await client.threads.create();
  const result = await client.runs.wait(
    thread.thread_id,
    "status-sync", // Status sync graph ID
    {
      input: {
        workspaceId,
        action: "list",
      },
    },
  );
  
  return (result as { jobs?: BackgroundJob[] })?.jobs || [];
};

/**
 * Get a specific job's status
 */
export const getJobById = async (
  workspaceId: string,
  jobId: string,
): Promise<BackgroundJob | null> => {
  const client = createClient();
  
  const thread = await client.threads.create();
  const result = await client.runs.wait(
    thread.thread_id,
    "status-sync",
    {
      input: {
        workspaceId,
        action: "get",
        jobId,
      },
    },
  );
  
  return (result as { currentJob?: BackgroundJob })?.currentJob || null;
};

/**
 * Stream job updates for real-time UI sync
 * 
 * Use this to subscribe to background job status updates.
 * The stream emits custom events that can be handled in the UI.
 */
export async function* streamJobUpdates(
  workspaceId: string,
  threadId?: string,
) {
  const client = createClient();
  
  const syncThreadId = threadId || `status-sync-${workspaceId}`;
  
  // Create or get the sync thread
  let thread;
  try {
    thread = await client.threads.get(syncThreadId);
  } catch {
    thread = await client.threads.create({ threadId: syncThreadId });
  }
  
  // Stream with custom mode to get job updates
  const stream = client.runs.stream(
    thread.thread_id,
    "status-sync",
    {
      input: {
        workspaceId,
        action: "subscribe",
      },
      streamMode: ["custom", "updates"],
    },
  );
  
  for await (const event of stream) {
    // Filter for job-related events
    if (event.event === "custom") {
      const data = event.data as { type?: string; data?: unknown };
      if (data.type === "job_update" || data.type === "jobs_list" || data.type === "active_jobs_summary") {
        yield data;
      }
    }
  }
}