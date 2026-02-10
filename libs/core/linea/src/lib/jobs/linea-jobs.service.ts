import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { JobsOptions, JobType, Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  LINEA_HEARTBEAT_INTERVAL_MS,
  LINEA_HEARTBEAT_REFLECTION_INTERVAL_MS,
  LINEA_JOB_HEARTBEAT,
  LINEA_JOB_SCHEDULED_TASK,
  LINEA_JOBS_QUEUE,
} from './linea-jobs.constants';
import type {
  LineaHeartbeatJobData,
  LineaJobStatus,
  LineaJobSummary,
  LineaScheduledTaskJobData,
  ScheduledTaskResult,
  ScheduleTaskRequest,
} from './linea-jobs.types';

@Injectable()
export class LineaJobsService {
  private readonly logger = new Logger(LineaJobsService.name);

  constructor(
    @InjectQueue(LINEA_JOBS_QUEUE)
    private readonly queue: Queue,
  ) {}

  async ensureHeartbeat(workspaceId: string, userId: string): Promise<void> {
    const jobId = `heartbeat:${workspaceId}`;
    try {
      await this.queue.add(
        LINEA_JOB_HEARTBEAT,
        {
          type: 'heartbeat',
          workspaceId,
          userId,
        },
        {
          jobId,
          repeat: { every: LINEA_HEARTBEAT_INTERVAL_MS },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );

      this.logger.log({ workspaceId, jobId }, 'Scheduled Linea heartbeat');
    } catch (error) {
      this.logger.warn(
        { err: error, workspaceId, jobId },
        'Failed to schedule Linea heartbeat',
      );
    }

    await this.ensureHeartbeatReflections(workspaceId, userId);
  }

  async scheduleTask(input: ScheduleTaskRequest): Promise<ScheduledTaskResult> {
    const taskId = input.name
      ? `scheduled:${input.workspaceId}:${input.name}`
      : `scheduled:${input.workspaceId}:${randomUUID()}`;

    const data: LineaScheduledTaskJobData = {
      type: 'scheduled_task',
      workspaceId: input.workspaceId,
      userId: input.userId,
      task: input.task,
      taskId,
      mode: input.mode,
      deliverToInbox:
        input.deliverToInbox ??
        (!input.replyToThreadId && input.mode !== 'execute'),
      replyToThreadId: input.replyToThreadId,
      runAt: input.runAt?.toISOString(),
      cron: input.cron,
      timezone: input.timezone,
    };

    const options: JobsOptions = {
      jobId: taskId,
      removeOnComplete: 50,
      removeOnFail: 50,
    };

    if (input.cron) {
      options.repeat = {
        pattern: input.cron,
        tz: input.timezone,
      };
    } else if (input.runAt) {
      options.delay = Math.max(0, input.runAt.getTime() - Date.now());
    }

    await this.queue.add(LINEA_JOB_SCHEDULED_TASK, data, options);

    this.logger.log(
      { workspaceId: input.workspaceId, taskId, cron: input.cron },
      'Scheduled Linea task',
    );

    return {
      jobId: taskId,
      runAt: input.runAt,
      cron: input.cron,
    };
  }

  async listJobsForWorkspace(
    workspaceId: string,
    limit = 200,
  ): Promise<LineaJobSummary[]> {
    const summaries: LineaJobSummary[] = [];
    const statuses: JobType[] = [
      'waiting',
      'delayed',
      'active',
      'completed',
      'failed',
      'paused',
      'waiting-children',
      'prioritized',
    ];

    const jobs = await this.queue.getJobs(
      statuses,
      0,
      Math.max(0, limit - 1),
      true,
    );

    for (const job of jobs) {
      const data = (job.data || {}) as Partial<
        LineaHeartbeatJobData | LineaScheduledTaskJobData
      >;
      const jobId = String(job.id);
      const matchesWorkspace =
        data.workspaceId === workspaceId ||
        jobId.includes(`:${workspaceId}:`) ||
        jobId.includes(`:${workspaceId}`) ||
        jobId.includes(`heartbeat:${workspaceId}`);

      if (!matchesWorkspace) {
        continue;
      }

      const state = this.normalizeJobStatus(await job.getState());
      const runAt = job.opts.delay
        ? new Date(job.timestamp + job.opts.delay)
        : undefined;
      const lastRunAt = job.processedOn
        ? new Date(job.processedOn)
        : job.finishedOn
          ? new Date(job.finishedOn)
          : undefined;

      summaries.push({
        id: String(job.id),
        name: job.name,
        type: data.type || job.name,
        status: state,
        task: (data as LineaScheduledTaskJobData).task,
        runAt,
        createdAt: job.timestamp ? new Date(job.timestamp) : undefined,
        lastRunAt,
      });
    }

    const schedulers = await this.queue.getJobSchedulers(0, limit);

    for (const scheduler of schedulers) {
      const templateData = scheduler.template?.data as
        | Partial<LineaHeartbeatJobData | LineaScheduledTaskJobData>
        | undefined;

      const schedulerId = scheduler.id || scheduler.key || '';
      const matchesWorkspace =
        templateData?.workspaceId === workspaceId ||
        schedulerId.includes(`:${workspaceId}:`) ||
        schedulerId.includes(`:${workspaceId}`) ||
        schedulerId.includes(`heartbeat:${workspaceId}`);

      if (!matchesWorkspace) {
        continue;
      }

      summaries.push({
        id: scheduler.id || scheduler.key,
        name: scheduler.name,
        type: templateData?.type || scheduler.name,
        status: 'repeatable',
        task: (templateData as LineaScheduledTaskJobData | undefined)?.task,
        cron: scheduler.pattern,
        timezone: scheduler.tz,
        nextRunAt: scheduler.next ? new Date(scheduler.next) : undefined,
        runAt: scheduler.startDate ? new Date(scheduler.startDate) : undefined,
      });
    }

    return summaries.sort((a, b) => {
      const aTime =
        a.nextRunAt?.getTime() ||
        a.runAt?.getTime() ||
        a.createdAt?.getTime() ||
        0;
      const bTime =
        b.nextRunAt?.getTime() ||
        b.runAt?.getTime() ||
        b.createdAt?.getTime() ||
        0;
      return bTime - aTime;
    });
  }

  private normalizeJobStatus(state: string): LineaJobStatus {
    if (state === 'waiting-children' || state === 'prioritized') {
      return 'waiting';
    }

    if (state === 'active') return 'active';
    if (state === 'delayed') return 'delayed';
    if (state === 'completed') return 'completed';
    if (state === 'failed') return 'failed';
    if (state === 'paused') return 'paused';

    return 'waiting';
  }

  private async ensureHeartbeatReflections(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const reflections = [
      {
        id: 'project',
        task: 'Review current projects and risks. Summarize progress, blockers, and where attention is needed.',
      },
      {
        id: 'team',
        task: 'Review team member updates and collaboration signals. Highlight wins, support needs, and potential handoffs.',
      },
      {
        id: 'agent',
        task: "Review Linea's recent runs and suggest agent improvements (prompts, tools, or workflows).",
      },
    ];

    for (const reflection of reflections) {
      const taskId = `heartbeat-reflection:${workspaceId}:${reflection.id}`;
      try {
        await this.queue.add(
          LINEA_JOB_SCHEDULED_TASK,
          {
            type: 'scheduled_task',
            workspaceId,
            userId,
            task: reflection.task,
            taskId,
            mode: 'suggest',
            deliverToInbox: true,
          },
          {
            jobId: taskId,
            repeat: { every: LINEA_HEARTBEAT_REFLECTION_INTERVAL_MS },
            removeOnComplete: 50,
            removeOnFail: 50,
          },
        );

        this.logger.log(
          { workspaceId, taskId },
          'Scheduled Linea heartbeat reflection',
        );
      } catch (error) {
        this.logger.warn(
          { err: error, workspaceId, taskId },
          'Failed to schedule Linea heartbeat reflection',
        );
      }
    }
  }
}
