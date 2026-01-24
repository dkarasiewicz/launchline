export type ScheduledTaskMode = 'suggest' | 'execute';

export type LineaJobStatus =
  | 'waiting'
  | 'delayed'
  | 'active'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'repeatable';

export interface LineaJobSummary {
  id: string;
  name: string;
  type: string;
  status: LineaJobStatus;
  task?: string;
  runAt?: Date;
  nextRunAt?: Date;
  cron?: string;
  timezone?: string;
  createdAt?: Date;
  lastRunAt?: Date;
}

export interface LineaHeartbeatJobData {
  type: 'heartbeat';
  workspaceId: string;
  userId: string;
}

export interface LineaScheduledTaskJobData {
  type: 'scheduled_task';
  workspaceId: string;
  userId: string;
  task: string;
  taskId: string;
  mode: ScheduledTaskMode;
  deliverToInbox: boolean;
  replyToThreadId?: string;
  runAt?: string;
  cron?: string;
  timezone?: string;
}

export type LineaJobData = LineaHeartbeatJobData | LineaScheduledTaskJobData;

export interface ScheduleTaskRequest {
  workspaceId: string;
  userId: string;
  task: string;
  runAt?: Date;
  cron?: string;
  timezone?: string;
  mode: ScheduledTaskMode;
  name?: string;
  deliverToInbox?: boolean;
  replyToThreadId?: string;
}

export interface ScheduledTaskResult {
  jobId: string;
  runAt?: Date;
  cron?: string;
}
