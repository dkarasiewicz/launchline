import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AuthenticatedUser,
  AuthenticatedWorkspace,
  CurrentUser,
  CurrentWorkspace,
} from '@launchline/core-common';
import {
  LineaJob,
  LineaJobListResponse,
  LineaJobStatus,
  LineaTeamGraph,
  LineaMemory,
  LineaMemoryListResponse,
  LineaSkill,
  LineaSkillListResponse,
  LineaMemoryQueryInput,
  LineaWorkspacePrompt,
  LineaHeartbeatSettings,
  LineaHeartbeatSummaryDelivery,
  UpdateLineaHeartbeatSettingsInput,
  UpsertLineaSkillInput,
  UpdateLineaWorkspacePromptInput,
} from './linea-admin.models';
import { LineaJobsService } from './jobs/linea-jobs.service';
import {
  HeartbeatSettingsService,
  MemoryService,
  TeamInsightsService,
} from './services';
import type { HeartbeatSummaryDelivery } from './services/heartbeat-settings.service';
import { AgentPromptService } from './services/agent-prompt.service';
import {
  MemoryNamespace,
  MemoryNamespaceSchema,
  type MemoryItem,
} from './types';

@Resolver()
export class LineaAdminResolver {
  constructor(
    private readonly jobsService: LineaJobsService,
    private readonly memoryService: MemoryService,
    private readonly agentPromptService: AgentPromptService,
    private readonly teamInsightsService: TeamInsightsService,
    private readonly heartbeatSettingsService: HeartbeatSettingsService,
  ) {}

  @Query(() => LineaJobListResponse)
  async lineaJobs(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
  ): Promise<LineaJobListResponse> {
    const jobs = await this.jobsService.listJobsForWorkspace(workspace.id);

    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        type: job.type,
        status: job.status as LineaJobStatus,
        task: job.task,
        runAt: job.runAt,
        nextRunAt: job.nextRunAt,
        cron: job.cron,
        timezone: job.timezone,
        createdAt: job.createdAt,
        lastRunAt: job.lastRunAt,
      })),
    };
  }

  @Query(() => LineaWorkspacePrompt, { nullable: true })
  async lineaWorkspacePrompt(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
  ): Promise<LineaWorkspacePrompt | null> {
    const record = await this.agentPromptService.getWorkspacePromptRecord(
      workspace.id,
    );

    if (!record) {
      return null;
    }

    return {
      prompt: record.prompt,
      updatedAt: new Date(record.updatedAt),
      updatedBy: record.updatedBy,
      version: record.version,
    };
  }

  @Query(() => LineaHeartbeatSettings)
  async lineaHeartbeatSettings(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
  ): Promise<LineaHeartbeatSettings> {
    const settings = await this.heartbeatSettingsService.getSettings(
      workspace.id,
    );

    return {
      enabled: settings.enabled,
      summaryDelivery: this.mapSummaryDelivery(settings.summaryDelivery),
      slackChannelId: settings.slackChannelId,
      quietHoursStart: settings.quietHoursStart,
      quietHoursEnd: settings.quietHoursEnd,
      timezone: settings.timezone,
      lastRunAt: settings.lastRunAt ? new Date(settings.lastRunAt) : undefined,
      updatedAt: settings.updatedAt ? new Date(settings.updatedAt) : undefined,
      updatedBy: settings.updatedBy,
    };
  }

  @Mutation(() => LineaHeartbeatSettings)
  async updateLineaHeartbeatSettings(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: UpdateLineaHeartbeatSettingsInput,
  ): Promise<LineaHeartbeatSettings> {
    const settings = await this.heartbeatSettingsService.updateSettings(
      workspace.id,
      user.userId,
      {
        ...input,
        summaryDelivery: this.mapSummaryDeliveryInput(input.summaryDelivery),
      },
    );

    return {
      enabled: settings.enabled,
      summaryDelivery: this.mapSummaryDelivery(settings.summaryDelivery),
      slackChannelId: settings.slackChannelId,
      quietHoursStart: settings.quietHoursStart,
      quietHoursEnd: settings.quietHoursEnd,
      timezone: settings.timezone,
      lastRunAt: settings.lastRunAt ? new Date(settings.lastRunAt) : undefined,
      updatedAt: settings.updatedAt ? new Date(settings.updatedAt) : undefined,
      updatedBy: settings.updatedBy,
    };
  }

  private mapSummaryDelivery(
    value: HeartbeatSummaryDelivery,
  ): LineaHeartbeatSummaryDelivery {
    switch (value) {
      case 'slack':
        return LineaHeartbeatSummaryDelivery.SLACK;
      case 'none':
        return LineaHeartbeatSummaryDelivery.NONE;
      case 'inbox':
      default:
        return LineaHeartbeatSummaryDelivery.INBOX;
    }
  }

  private mapSummaryDeliveryInput(
    value?: LineaHeartbeatSummaryDelivery,
  ): HeartbeatSummaryDelivery | undefined {
    if (!value) {
      return undefined;
    }

    switch (value) {
      case LineaHeartbeatSummaryDelivery.SLACK:
        return 'slack';
      case LineaHeartbeatSummaryDelivery.NONE:
        return 'none';
      case LineaHeartbeatSummaryDelivery.INBOX:
      default:
        return 'inbox';
    }
  }

  @Mutation(() => LineaWorkspacePrompt)
  async updateLineaWorkspacePrompt(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: UpdateLineaWorkspacePromptInput,
  ): Promise<LineaWorkspacePrompt> {
    const record = await this.agentPromptService.upsertWorkspacePrompt(
      workspace.id,
      input.prompt,
      user.userId,
    );

    return {
      prompt: record.prompt,
      updatedAt: new Date(record.updatedAt),
      updatedBy: record.updatedBy,
      version: record.version,
    };
  }

  @Query(() => LineaMemoryListResponse)
  async lineaMemories(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('input', { nullable: true }) input?: LineaMemoryQueryInput,
  ): Promise<LineaMemoryListResponse> {
    const query = input?.query?.trim() || '';
    const limit = input?.limit || 50;

    let namespaces: MemoryNamespace[] | undefined;
    if (input?.namespace) {
      const parsed = MemoryNamespaceSchema.safeParse(input.namespace);
      if (parsed.success) {
        namespaces = [parsed.data as MemoryNamespace];
      }
    }

    const memories = await this.memoryService.searchMemories({
      workspaceId: workspace.id,
      query,
      limit,
      namespaces,
    });

    return {
      memories: memories.map<LineaMemory>((memory) => {
        const namespace = memory.namespace ?? 'workspace';
        const category = memory.category ?? 'note';
        const content = memory.content ?? '';
        const summary =
          memory.summary ?? (content ? content.slice(0, 160) : 'Memory');
        const importance =
          typeof memory.importance === 'number' ? memory.importance : 0.5;

        return {
          id: memory.id,
          namespace,
          category,
          summary,
          content,
          importance,
          updatedAt: memory.updatedAt ? new Date(memory.updatedAt) : undefined,
          createdAt: memory.createdAt ? new Date(memory.createdAt) : undefined,
        };
      }),
    };
  }

  @Query(() => LineaSkillListResponse)
  async lineaSkills(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
  ): Promise<LineaSkillListResponse> {
    const memories = await this.memoryService.listMemories(
      workspace.id,
      'workspace',
      { limit: 200 },
    );

    const skills = memories
      .filter((memory) => memory.category === 'skill')
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });

    return {
      skills: skills.map((memory) => this.mapSkill(memory)),
    };
  }

  @Mutation(() => LineaSkill)
  async upsertLineaSkill(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: UpsertLineaSkillInput,
  ): Promise<LineaSkill> {
    const name = input.name.trim();
    const content = input.content.trim();
    const ctx = {
      workspaceId: workspace.id,
      userId: user.userId,
      correlationId: `skill-${Date.now()}`,
    };

    let existing: MemoryItem | null = null;

    if (input.id) {
      existing = await this.memoryService.getMemory(
        ctx,
        input.id,
        'workspace',
      );
    }

    if (!existing) {
      const memories = await this.memoryService.listMemories(
        workspace.id,
        'workspace',
        { limit: 200 },
      );
      existing =
        memories.find(
          (memory) =>
            memory.category === 'skill' &&
            memory.summary?.toLowerCase() === name.toLowerCase(),
        ) || null;
    }

    if (existing) {
      const updated = await this.memoryService.updateMemory(
        ctx,
        existing.id,
        'workspace',
        {
          content,
          summary: name,
          importance: existing.importance ?? 0.7,
          confidence: existing.confidence ?? 0.9,
        },
      );

      if (updated) {
        return this.mapSkill(updated);
      }
    }

    const created = await this.memoryService.saveMemory(ctx, {
      namespace: 'workspace',
      category: 'skill',
      content,
      summary: name,
      importance: 0.7,
      confidence: 0.9,
      sourceEventIds: [],
      relatedEntityIds: [],
      relatedMemoryIds: [],
      entityRefs: {},
    });

    return this.mapSkill(created);
  }

  @Query(() => LineaTeamGraph)
  async lineaTeamGraph(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<LineaTeamGraph> {
    const safeLimit = Math.min(Math.max(limit ?? 240, 20), 500);
    return this.teamInsightsService.buildTeamGraph(workspace.id, safeLimit);
  }

  private mapSkill(memory: MemoryItem): LineaSkill {
    return {
      id: memory.id,
      name: memory.summary || 'Untitled skill',
      content: memory.content || '',
      updatedAt: memory.updatedAt ? new Date(memory.updatedAt) : undefined,
      createdAt: memory.createdAt ? new Date(memory.createdAt) : undefined,
    };
  }
}
