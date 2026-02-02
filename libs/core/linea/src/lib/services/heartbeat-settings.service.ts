import { Injectable, Logger } from '@nestjs/common';
import { MemoryService } from './memory.service';
import type { GraphContext, MemoryItem } from '../types';

export type HeartbeatSummaryDelivery = 'inbox' | 'slack' | 'none';

export interface HeartbeatSettings {
  enabled: boolean;
  summaryDelivery: HeartbeatSummaryDelivery;
  slackChannelId?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  lastRunAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_HEARTBEAT_SETTINGS: HeartbeatSettings = {
  enabled: true,
  summaryDelivery: 'inbox',
  timezone: 'UTC',
};

const SETTINGS_SUMMARY = 'Heartbeat settings';

@Injectable()
export class HeartbeatSettingsService {
  private readonly logger = new Logger(HeartbeatSettingsService.name);

  constructor(private readonly memoryService: MemoryService) {}

  async getSettings(workspaceId: string): Promise<HeartbeatSettings> {
    const record = await this.getSettingsRecord(workspaceId);
    if (!record) {
      return { ...DEFAULT_HEARTBEAT_SETTINGS };
    }

    return {
      ...DEFAULT_HEARTBEAT_SETTINGS,
      ...record,
    };
  }

  async updateSettings(
    workspaceId: string,
    updatedBy: string,
    input: Partial<HeartbeatSettings>,
  ): Promise<HeartbeatSettings> {
    const existing = await this.getSettingsRecord(workspaceId);
    const next: HeartbeatSettings = {
      ...DEFAULT_HEARTBEAT_SETTINGS,
      ...(existing || {}),
      ...input,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await this.saveSettingsRecord(workspaceId, updatedBy, next, existing);

    return next;
  }

  async recordHeartbeatRun(
    workspaceId: string,
    updatedBy: string,
    lastRunAt: Date,
  ): Promise<void> {
    const existing = await this.getSettingsRecord(workspaceId);
    const next: HeartbeatSettings = {
      ...DEFAULT_HEARTBEAT_SETTINGS,
      ...(existing || {}),
      lastRunAt: lastRunAt.toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await this.saveSettingsRecord(workspaceId, updatedBy, next, existing);
  }

  private async getSettingsRecord(
    workspaceId: string,
  ): Promise<HeartbeatSettings | null> {
    try {
      const results = await this.memoryService.searchStore(
        ['workspaces', workspaceId, 'workspace'],
        '',
        50,
      );

      const candidates = results
        .map((item) => item.value as unknown as MemoryItem)
        .filter(
          (memory) =>
            memory.category === 'settings' &&
            memory.summary === SETTINGS_SUMMARY,
        );

      if (candidates.length === 0) {
        return null;
      }

      const latest = candidates.sort((a, b) => {
        const aTime =
          a.updatedAt instanceof Date
            ? a.updatedAt
            : new Date(a.updatedAt as unknown as string);
        const bTime =
          b.updatedAt instanceof Date
            ? b.updatedAt
            : new Date(b.updatedAt as unknown as string);
        return bTime.getTime() - aTime.getTime();
      })[0];

      const parsed = this.parseSettings(latest.content);
      if (!parsed) {
        return null;
      }

      return parsed;
    } catch (error) {
      this.logger.warn(
        { err: error, workspaceId },
        'Failed to load heartbeat settings',
      );
      return null;
    }
  }

  private parseSettings(content: string): HeartbeatSettings | null {
    try {
      const parsed = JSON.parse(content) as Partial<HeartbeatSettings>;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return {
        ...DEFAULT_HEARTBEAT_SETTINGS,
        ...parsed,
      } as HeartbeatSettings;
    } catch {
      return null;
    }
  }

  private async saveSettingsRecord(
    workspaceId: string,
    updatedBy: string,
    settings: HeartbeatSettings,
    existing: HeartbeatSettings | null,
  ): Promise<void> {
    const ctx: GraphContext = {
      workspaceId,
      userId: updatedBy || 'system',
      correlationId: `heartbeat-settings-${Date.now()}`,
    };

    const content = JSON.stringify(settings);

    const existingMemory = await this.getSettingsMemory(workspaceId);

    if (existingMemory) {
      await this.memoryService.updateMemory(ctx, existingMemory.id, 'workspace', {
        content,
        summary: SETTINGS_SUMMARY,
        importance: 0.6,
        confidence: 1,
      });
      return;
    }

    await this.memoryService.saveMemory(ctx, {
      namespace: 'workspace',
      category: 'settings',
      content,
      summary: SETTINGS_SUMMARY,
      importance: 0.6,
      confidence: 1,
      sourceEventIds: [],
      relatedEntityIds: [],
      relatedMemoryIds: [],
      entityRefs: {},
    });
  }

  private async getSettingsMemory(
    workspaceId: string,
  ): Promise<MemoryItem | null> {
    const results = await this.memoryService.searchStore(
      ['workspaces', workspaceId, 'workspace'],
      '',
      50,
    );

    const candidates = results
      .map((item) => item.value as unknown as MemoryItem)
      .filter(
        (memory) =>
          memory.category === 'settings' &&
          memory.summary === SETTINGS_SUMMARY,
      );

    if (candidates.length === 0) {
      return null;
    }

    const latest = candidates.sort((a, b) => {
      const aTime =
        a.updatedAt instanceof Date
          ? a.updatedAt
          : new Date(a.updatedAt as unknown as string);
      const bTime =
        b.updatedAt instanceof Date
          ? b.updatedAt
          : new Date(b.updatedAt as unknown as string);
      return bTime.getTime() - aTime.getTime();
    })[0];

    return latest;
  }
}
