import { Injectable, Logger } from '@nestjs/common';
import { MemoryService } from './memory.service';
import type { GraphContext, MemoryItem } from '../types';

export interface WorkspacePromptRecord {
  prompt: string;
  updatedAt: string;
  updatedBy?: string;
  version: number;
}

@Injectable()
export class AgentPromptService {
  private readonly logger = new Logger(AgentPromptService.name);

  constructor(private readonly memoryService: MemoryService) {}

  async getWorkspacePrompt(workspaceId: string): Promise<string | null> {
    const record = await this.getPromptRecord(workspaceId);
    return record?.prompt || null;
  }

  async getWorkspacePromptRecord(
    workspaceId: string,
  ): Promise<WorkspacePromptRecord | null> {
    return this.getPromptRecord(workspaceId);
  }

  async upsertWorkspacePrompt(
    workspaceId: string,
    prompt: string,
    updatedBy?: string,
  ): Promise<WorkspacePromptRecord> {
    const existing = await this.getPromptRecord(workspaceId);
    const nextVersion = existing?.version ? existing.version + 1 : 1;
    const ctx = this.buildContext(workspaceId, updatedBy);
    const summary = 'Workspace instructions for Linea';

    let memory: MemoryItem | null = null;
    const existingMemory = await this.getPromptMemory(workspaceId);

    const metadata = {
      updatedBy,
      version: nextVersion,
    } as Record<string, unknown>;

    if (existingMemory) {
      memory = await this.memoryService.updateMemory(
        ctx,
        existingMemory.id,
        'workspace',
        {
          content: prompt,
          summary,
          importance: 1,
          confidence: 1,
          ...metadata,
        },
      );
    } else {
      memory = await this.memoryService.saveMemory(ctx, {
        namespace: 'workspace',
        category: 'instruction',
        content: prompt,
        summary,
        importance: 1,
        confidence: 1,
        sourceEventIds: [],
        relatedEntityIds: [],
        relatedMemoryIds: [],
        entityRefs: {},
        ...metadata,
      } as unknown as {
        namespace: 'workspace';
        category: 'instruction';
        content: string;
        summary: string;
        importance: number;
        confidence: number;
        sourceEventIds: string[];
        relatedEntityIds: string[];
        relatedMemoryIds: string[];
        entityRefs: Record<string, unknown>;
      });
    }

    this.logger.log(
      { workspaceId, version: nextVersion, updatedBy },
      'Updated workspace agent prompt',
    );

    const resolvedUpdatedAt = memory?.updatedAt
      ? memory.updatedAt instanceof Date
        ? memory.updatedAt
        : new Date(memory.updatedAt as unknown as string)
      : new Date();

    return {
      prompt,
      updatedAt: resolvedUpdatedAt.toISOString(),
      updatedBy,
      version: nextVersion,
    };
  }

  private async getPromptRecord(
    workspaceId: string,
  ): Promise<WorkspacePromptRecord | null> {
    try {
      const memory = await this.getPromptMemory(workspaceId);
      if (!memory) {
        return null;
      }

      const updatedAt =
        memory.updatedAt instanceof Date
          ? memory.updatedAt
          : new Date(memory.updatedAt as unknown as string);

      return {
        prompt: memory.content,
        updatedAt: updatedAt.toISOString(),
        updatedBy:
          (memory as unknown as { updatedBy?: string }).updatedBy || undefined,
        version: (memory as unknown as { version?: number }).version || 1,
      };
    } catch (error) {
      this.logger.error(
        { err: error, workspaceId },
        'Failed to load workspace prompt',
      );
      return null;
    }
  }

  private buildContext(workspaceId: string, updatedBy?: string): GraphContext {
    return {
      workspaceId,
      userId: updatedBy || 'system',
      correlationId: `workspace-prompt-${Date.now()}`,
    };
  }

  private async getPromptMemory(
    workspaceId: string,
  ): Promise<MemoryItem | null> {
    const results = await this.memoryService.searchStore(
      ['workspaces', workspaceId, 'workspace'],
      '',
      25,
    );

    const candidates = results
      .map((item) => item.value as unknown as MemoryItem)
      .filter((memory) => memory.category === 'instruction');

    if (candidates.length === 0) {
      return null;
    }

    const getUpdatedAt = (memory: MemoryItem) =>
      memory.updatedAt instanceof Date
        ? memory.updatedAt
        : new Date(memory.updatedAt as unknown as string);

    candidates.sort(
      (a, b) => getUpdatedAt(b).getTime() - getUpdatedAt(a).getTime(),
    );

    return candidates[0];
  }
}
