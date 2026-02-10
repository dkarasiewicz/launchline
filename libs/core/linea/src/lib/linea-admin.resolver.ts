import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AuthenticatedUser,
  AuthenticatedWorkspace,
  CurrentUser,
  CurrentWorkspace,
} from '@launchline/core-common';
import {
  LineaJobListResponse,
  LineaJobStatus,
  LineaTeamGraph,
  LineaMemory,
  LineaMemoryListResponse,
  LineaMemoryTimelineInput,
  LineaMemoryTimelineResponse,
  LineaSkill,
  LineaSkillListResponse,
  LineaMemoryQueryInput,
  LineaWorkspacePrompt,
  LineaHeartbeatSettings,
  LineaHeartbeatSummaryDelivery,
  ReonboardIntegrationInput,
  UpdateLineaHeartbeatSettingsInput,
  UpsertLineaSkillInput,
  UpdateLineaWorkspacePromptInput,
} from './linea-admin.models';
import { LineaJobsService } from './jobs/linea-jobs.service';
import {
  HeartbeatSettingsService,
  MemoryService,
  TeamInsightsService,
  WorkspaceSkillsService,
} from './services';
import type { HeartbeatSummaryDelivery } from './services/heartbeat-settings.service';
import { AgentPromptService } from './services/agent-prompt.service';
import {
  MemoryNamespace,
  MemoryNamespaceSchema,
  type EntityRefs,
} from './types';
import { LineaQueue } from './linea.queue';

@Resolver()
export class LineaAdminResolver {
  constructor(
    private readonly jobsService: LineaJobsService,
    private readonly memoryService: MemoryService,
    private readonly agentPromptService: AgentPromptService,
    private readonly teamInsightsService: TeamInsightsService,
    private readonly heartbeatSettingsService: HeartbeatSettingsService,
    private readonly workspaceSkillsService: WorkspaceSkillsService,
    private readonly lineaQueue: LineaQueue,
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

  @Mutation(() => Boolean)
  async reonboardIntegration(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: ReonboardIntegrationInput,
  ): Promise<boolean> {
    return this.lineaQueue.reonboardIntegration(
      workspace.id,
      user.userId,
      input.integrationId,
      { clearData: input.clearData },
    );
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

  @Query(() => LineaMemoryTimelineResponse)
  async lineaMemoryTimeline(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('input') input: LineaMemoryTimelineInput,
  ): Promise<LineaMemoryTimelineResponse> {
    const entityId = input.entityId?.trim();
    const limit = Math.min(Math.max(input.limit ?? 60, 1), 200);

    if (!entityId) {
      return { memories: [] };
    }

    const { entityIds, entityRefs } = this.buildTimelineRefs(
      entityId,
      input.entityType,
    );

    const memories = await this.memoryService.getEntityTimeline(workspace.id, {
      entityIds,
      entityRefs,
      limit,
      includeArchived: input.includeArchived ?? false,
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
    const skills = await this.workspaceSkillsService.listWorkspaceSkills(
      workspace.id,
    );

    return {
      skills: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        content: skill.content,
        updatedAt: skill.updatedAt,
        createdAt: skill.createdAt,
      })),
    };
  }

  @Mutation(() => LineaSkill)
  async upsertLineaSkill(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @CurrentUser() _user: AuthenticatedUser,
    @Args('input') input: UpsertLineaSkillInput,
  ): Promise<LineaSkill> {
    const name = input.name.trim();
    const content = input.content.trim();

    const saved = await this.workspaceSkillsService.upsertWorkspaceSkill(
      workspace.id,
      name,
      content,
      { id: input.id },
    );

    return {
      id: saved.id,
      name: saved.name,
      content: saved.content,
      updatedAt: saved.updatedAt,
      createdAt: saved.createdAt,
    };
  }

  @Mutation(() => Boolean)
  async deleteLineaSkill(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @CurrentUser() user: AuthenticatedUser,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.workspaceSkillsService.deleteWorkspaceSkill(workspace.id, id, {
      userId: user.userId,
    });
  }

  @Query(() => LineaTeamGraph)
  async lineaTeamGraph(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<LineaTeamGraph> {
    const safeLimit = Math.min(Math.max(limit ?? 240, 20), 500);
    return this.teamInsightsService.buildTeamGraph(workspace.id, safeLimit);
  }

  private buildTimelineRefs(
    entityId: string,
    entityType?: string,
  ): {
    entityIds: string[];
    entityRefs: EntityRefs;
  } {
    const entityIds = new Set<string>();
    const entityRefs: EntityRefs = {};

    const addRef = (key: keyof EntityRefs, value?: string) => {
      if (!value) return;
      const existing = entityRefs[key] || [];
      if (!existing.includes(value)) {
        entityRefs[key] = [...existing, value];
      }
    };

    const addEntityId = (value?: string) => {
      if (value) {
        entityIds.add(value);
      }
    };

    addEntityId(entityId);

    if (entityId.startsWith('user:')) {
      const raw = entityId.slice(5);
      addRef('userIds', raw);
      addEntityId(raw);
    } else if (entityId.startsWith('ticket:')) {
      const raw = entityId.slice(7);
      addRef('ticketIds', raw);
      addEntityId(raw);
    } else if (entityId.startsWith('project:')) {
      const raw = entityId.slice(8);
      addRef('projectIds', raw);
      addEntityId(raw);
    } else if (entityId.startsWith('team:')) {
      const raw = entityId.slice(5);
      addRef('teamIds', raw);
      addEntityId(raw);
    } else if (entityId.startsWith('pr:')) {
      const raw = entityId.slice(3);
      addRef('prIds', raw);
      addEntityId(raw);
    } else if (entityId.startsWith('gh-pr:')) {
      addRef('prIds', entityId);
    } else if (entityType) {
      switch (entityType) {
        case 'person':
          addRef('userIds', entityId);
          break;
        case 'ticket':
          addRef('ticketIds', entityId);
          break;
        case 'project':
          addRef('projectIds', entityId);
          break;
        case 'team':
          addRef('teamIds', entityId);
          break;
        case 'pr':
          addRef('prIds', entityId);
          break;
        default:
          break;
      }
    }

    return { entityIds: Array.from(entityIds), entityRefs };
  }
}
