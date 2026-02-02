import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LineaFacade } from '../linea.facade';
import { AgentFactory } from '../services/agent.factory';
import { HeartbeatSettingsService } from '../services/heartbeat-settings.service';
import {
  LINEA_JOB_HEARTBEAT,
  LINEA_JOB_SCHEDULED_TASK,
  LINEA_JOBS_QUEUE,
} from './linea-jobs.constants';
import type {
  LineaHeartbeatJobData,
  LineaJobData,
  LineaScheduledTaskJobData,
} from './linea-jobs.types';
import type { InboxPriority } from '../types';
import {
  IntegrationFacade,
  IntegrationType,
  SlackService,
} from '@launchline/core-integration';

type HeartbeatReport = {
  actionable?: boolean;
  title?: string;
  summary?: string;
  priority?: string;
  suggested_actions?: string[];
  related?: {
    ticketIds?: string[];
    prIds?: string[];
    userIds?: string[];
    teamIds?: string[];
  };
};

@Processor(LINEA_JOBS_QUEUE)
export class LineaJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(LineaJobsProcessor.name);

  constructor(
    private readonly agentFactory: AgentFactory,
    private readonly lineaFacade: LineaFacade,
    private readonly heartbeatSettingsService: HeartbeatSettingsService,
    private readonly integrationFacade: IntegrationFacade,
    private readonly slackService: SlackService,
  ) {
    super();
  }

  async process(job: Job<LineaJobData>): Promise<void> {
    switch (job.name) {
      case LINEA_JOB_HEARTBEAT:
        await this.handleHeartbeat(job as Job<LineaHeartbeatJobData>);
        return;
      case LINEA_JOB_SCHEDULED_TASK:
        await this.handleScheduledTask(job as Job<LineaScheduledTaskJobData>);
        return;
      default:
        this.logger.warn(
          { jobName: job.name, jobId: job.id },
          'Unhandled Linea job',
        );
    }
  }

  private async handleHeartbeat(
    job: Job<LineaHeartbeatJobData>,
  ): Promise<void> {
    const { workspaceId, userId } = job.data;
    const threadId = `heartbeat-${workspaceId}`;
    const now = new Date();
    const settings =
      await this.heartbeatSettingsService.getSettings(workspaceId);

    if (!settings.enabled) {
      this.logger.debug(
        { workspaceId, jobId: job.id },
        'Heartbeat disabled for workspace',
      );
      return;
    }

    const inQuietHours = this.isInQuietHours(settings, now);
    const agent = await this.agentFactory.getAgentForWorkspace(workspaceId);

    const messages: Array<{ type: string; content: string }> = [
      {
        type: 'system',
        content: this.buildHeartbeatPrompt(
          settings.lastRunAt,
          settings.timezone || 'UTC',
        ),
      },
      {
        type: 'human',
        content: 'Run the heartbeat now.',
      },
    ];

    const result = (await agent.invoke(
      { messages },
      {
        configurable: {
          thread_id: threadId,
          workspaceId,
          userId,
        },
      },
    )) as { messages?: Array<{ content?: unknown }> } | undefined;

    const reply = this.extractReply(result);
    if (!reply) {
      this.logger.warn(
        { workspaceId, jobId: job.id },
        'Heartbeat produced no output',
      );
      await this.heartbeatSettingsService.recordHeartbeatRun(
        workspaceId,
        userId,
        now,
      );
      return;
    }

    const report = this.parseHeartbeatReport(reply);
    if (!report) {
      this.logger.warn(
        { workspaceId, jobId: job.id },
        'Heartbeat output was not valid JSON',
      );
      await this.heartbeatSettingsService.recordHeartbeatRun(
        workspaceId,
        userId,
        now,
      );
      return;
    }

    const summary = (report.summary || '').trim();
    const title = report.title || 'Heartbeat update';
    const actionable = report.actionable === true;

    if (actionable) {
      await this.lineaFacade.createInboxThread({
        workspaceId,
        userId,
        type: 'action_required',
        priority: this.normalizePriority(report.priority),
        title,
        summary: summary || 'Heartbeat flagged items needing attention.',
        suggestedActions: report.suggested_actions || [],
        sourceMemoryIds: [],
        entityRefs: report.related || {},
      });
    }

    const shouldSendSummary =
      summary.length > 0 &&
      !inQuietHours &&
      settings.summaryDelivery !== 'none' &&
      !this.isTrivialSummary(summary) &&
      !(actionable && settings.summaryDelivery === 'inbox');

    if (shouldSendSummary) {
      if (settings.summaryDelivery === 'inbox') {
        await this.lineaFacade.createInboxThread({
          workspaceId,
          userId,
          type: actionable ? 'update' : 'update',
          priority: actionable ? 'medium' : 'low',
          title,
          summary,
          suggestedActions: report.suggested_actions || [],
          sourceMemoryIds: [],
          entityRefs: report.related || {},
        });
      }

      if (settings.summaryDelivery === 'slack' && settings.slackChannelId) {
        await this.sendSlackHeartbeatSummary(
          workspaceId,
          settings.slackChannelId,
          {
            title,
            summary,
            actionable,
            suggested_actions: report.suggested_actions || [],
          },
        );
      }
    }

    await this.heartbeatSettingsService.recordHeartbeatRun(
      workspaceId,
      userId,
      now,
    );
  }

  private async handleScheduledTask(
    job: Job<LineaScheduledTaskJobData>,
  ): Promise<void> {
    const {
      workspaceId,
      userId,
      task,
      taskId,
      mode,
      deliverToInbox,
      replyToThreadId,
    } = job.data;
    const threadId = replyToThreadId || `scheduled-task-${taskId}`;
    const agent = await this.agentFactory.getAgentForWorkspace(workspaceId);

    const messages: Array<{ type: string; content: string }> = [
      { type: 'system', content: this.buildScheduledTaskPrompt(mode) },
      {
        type: 'human',
        content: task,
      },
    ];

    const result = (await agent.invoke(
      { messages },
      {
        configurable: {
          thread_id: threadId,
          workspaceId,
          userId,
        },
      },
    )) as { messages?: Array<{ content?: unknown }> } | undefined;

    const reply = this.extractReply(result);
    if (!reply) {
      this.logger.warn(
        { workspaceId, taskId, jobId: job.id },
        'Scheduled task produced no output',
      );
      return;
    }

    if (!deliverToInbox) {
      return;
    }

    await this.lineaFacade.createInboxThread({
      workspaceId,
      userId,
      type: 'update',
      priority: 'low',
      title: `Scheduled task: ${task.slice(0, 60)}`,
      summary: reply.slice(0, 1200),
      suggestedActions: [],
      sourceMemoryIds: [],
      entityRefs: {},
    });
  }

  private buildHeartbeatPrompt(lastRunAt?: string, timezone = 'UTC'): string {
    const lastRunLine = lastRunAt
      ? `Last heartbeat ran at ${lastRunAt} (${timezone}). Focus on changes since then.`
      : 'No previous heartbeat recorded. Build a baseline snapshot.';

    return `You are running Linea's autonomous heartbeat.

Your job: check the latest signals (Linear, Slack, GitHub, Email, Calendar) and return a concise,
structured report for the PM. ${lastRunLine}

Rules:
- Use tools to fetch live data (blockers, stalled work, workload, cycle status, PRs, commits, Slack summaries).
- Do NOT take external actions (no ticket updates, no Slack messages) during heartbeat.
- Return STRICT JSON only (no markdown, no code fences).

Schema:
{
  "actionable": boolean,
  "title": string,
  "summary": string,
  "priority": "critical" | "high" | "medium" | "low",
  "suggested_actions": string[],
  "related": {
    "ticketIds": string[],
    "prIds": string[],
    "userIds": string[],
    "teamIds": string[]
  }
}

If there is nothing urgent, set "actionable" to false and summarize the state briefly.`;
  }

  private buildScheduledTaskPrompt(mode: 'suggest' | 'execute'): string {
    const actionPolicy =
      mode === 'execute'
        ? 'You have explicit approval to execute safe actions needed for this task. If the task asks to create/update something and you have enough details, do it.'
        : 'Do NOT execute actions. Provide a plan or draft output instead.';

    return `You are running a scheduled task for Linea.

${actionPolicy}

Guardrails:
- Avoid destructive actions (deletions, mass updates).
- If unsure, stop and summarize next steps.
- Keep responses concise and actionable.
- When executing, use tools directly instead of asking for confirmation.`;
  }

  private extractReply(
    result: { messages?: Array<{ content?: unknown }> } | undefined,
  ): string | null {
    const lastMessage = result?.messages?.at(-1);
    const content = lastMessage?.content;

    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => String(part))
        .join('\n')
        .trim();
    }

    return null;
  }

  private parseHeartbeatReport(text: string): HeartbeatReport | null {
    const raw = this.stripCodeFence(text);
    const candidates = [raw];
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch?.[0] && jsonMatch[0] !== raw) {
      candidates.push(jsonMatch[0]);
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as HeartbeatReport;
        return parsed;
      } catch {
        continue;
      }
    }

    const fallback = raw.trim();
    if (!fallback) {
      return null;
    }

    return {
      actionable: false,
      title: 'Heartbeat summary',
      summary: fallback,
      priority: 'medium',
      suggested_actions: [],
      related: {},
    };
  }

  private stripCodeFence(text: string): string {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) {
      return match[1].trim();
    }

    return text.trim();
  }

  private normalizePriority(priority?: string): InboxPriority {
    if (!priority) {
      return 'medium';
    }

    if (
      priority === 'critical' ||
      priority === 'high' ||
      priority === 'medium' ||
      priority === 'low'
    ) {
      return priority;
    }

    return 'medium';
  }

  private parseTimeToMinutes(value?: string): number | null {
    if (!value) return null;
    const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour * 60 + minute;
  }

  private isInQuietHours(
    settings: {
      quietHoursStart?: string;
      quietHoursEnd?: string;
      timezone?: string;
    },
    now: Date,
  ): boolean {
    const start = this.parseTimeToMinutes(settings.quietHoursStart);
    const end = this.parseTimeToMinutes(settings.quietHoursEnd);

    if (start === null || end === null || start === end) {
      return false;
    }

    const timeZone = settings.timezone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0');
    const current = hour * 60 + minute;

    if (start < end) {
      return current >= start && current < end;
    }

    return current >= start || current < end;
  }

  private isTrivialSummary(summary: string): boolean {
    const normalized = summary.toLowerCase();
    return (
      normalized.includes('no notable') ||
      normalized.includes('no urgent') ||
      normalized.includes('nothing urgent') ||
      normalized.includes('no updates') ||
      normalized.includes('no changes') ||
      normalized.includes('no changes since last run') ||
      summary.trim().length < 20
    );
  }

  private async sendSlackHeartbeatSummary(
    workspaceId: string,
    channelId: string,
    report: {
      title: string;
      summary: string;
      actionable: boolean;
      suggested_actions: string[];
    },
  ): Promise<void> {
    const integrations = await this.integrationFacade.getIntegrationsByType(
      workspaceId,
      IntegrationType.SLACK,
    );

    const integrationId = integrations[0]?.id;
    if (!integrationId) {
      this.logger.warn(
        { workspaceId },
        'Slack summary requested but no Slack integration found',
      );
      return;
    }

    const token = await this.integrationFacade.getAccessToken(integrationId);
    if (!token) {
      this.logger.warn(
        { workspaceId, integrationId },
        'Slack summary requested but no token available',
      );
      return;
    }

    const lines = [
      `*${report.title}*`,
      report.summary,
      report.suggested_actions?.length
        ? `\nSuggested actions:\n${report.suggested_actions
            .map((action) => `• ${action}`)
            .join('\n')}`
        : '',
      report.actionable ? '\nStatus: Action needed' : '\nStatus: FYI',
    ]
      .filter(Boolean)
      .join('\n');

    await this.slackService.postMessage(token, channelId, lines);
  }

  // No thread history check needed; workspace prompt is embedded in agent.
}
