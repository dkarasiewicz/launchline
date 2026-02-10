import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import { randomUUID as uuidv4 } from 'node:crypto';
import { LINEA_STORE } from '../tokens';
import {
  type GraphContext,
  type MemoryItem,
  type MemoryItemInput,
  MemoryItemInputSchema,
  MemoryNamespaceSchema,
  type MemoryNamespace,
  type MemorySearchQuery,
  type EntityRefs,
} from '../types';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    @Inject(LINEA_STORE)
    private readonly store: PostgresStore,
  ) {}

  buildNamespace(
    workspaceId: string,
    namespace: MemoryNamespace,
    entityId?: string,
  ): string[] {
    const base = ['workspaces', workspaceId, namespace];
    if (entityId) {
      return [...base, entityId];
    }
    return base;
  }

  async saveMemory(
    ctx: GraphContext,
    memory: MemoryItemInput,
    entityId?: string,
  ): Promise<MemoryItem> {
    const validationResult = MemoryItemInputSchema.safeParse(memory);

    if (!validationResult.success) {
      this.logger.error(
        `Memory validation failed: ${validationResult.error.message}`,
      );
      throw new Error(
        `Invalid memory input: ${validationResult.error.message}`,
      );
    }

    const validatedMemory = validationResult.data;
    const now = new Date();
    const id = uuidv4();

    const fullMemory: MemoryItem = {
      ...validatedMemory,
      id,
      workspaceId: ctx.workspaceId,
      createdAt: now,
      updatedAt: now,
    };

    const namespace = this.buildNamespace(
      ctx.workspaceId,
      validatedMemory.namespace,
      entityId,
    );

    await this.store.put(namespace, id, {
      ...fullMemory,
      text: validatedMemory.content,
    });

    this.logger.debug(
      `Saved memory ${id} (${validatedMemory.category}) in ${validatedMemory.namespace} for workspace ${ctx.workspaceId}`,
    );

    await this.upsertMemoryFile(ctx.workspaceId, fullMemory);

    return fullMemory;
  }

  async updateMemory(
    ctx: GraphContext,
    memoryId: string,
    namespace: MemoryNamespace,
    updates: Partial<MemoryItem>,
    entityId?: string,
  ): Promise<MemoryItem | null> {
    const ns = this.buildNamespace(ctx.workspaceId, namespace, entityId);
    const existing = await this.store.get(ns, memoryId);

    if (!existing?.value) {
      this.logger.warn(`[MemoryService] Memory ${memoryId} not found`);

      return null;
    }

    const updated: MemoryItem = {
      ...(existing.value as MemoryItem),
      ...updates,
      updatedAt: new Date(),
    };

    await this.store.put(ns, memoryId, {
      ...updated,
      text: updated.content,
    });

    this.logger.debug(`[MemoryService] Updated memory ${memoryId}`);

    await this.upsertMemoryFile(ctx.workspaceId, updated);

    return updated;
  }

  async archiveMemory(
    ctx: GraphContext,
    memoryId: string,
    namespace: MemoryNamespace,
    entityId?: string,
  ): Promise<boolean> {
    const updated = await this.updateMemory(
      ctx,
      memoryId,
      namespace,
      { archivedAt: new Date() },
      entityId,
    );

    return updated !== null;
  }

  async getMemory(
    ctx: GraphContext,
    memoryId: string,
    namespace: MemoryNamespace,
    entityId?: string,
  ): Promise<MemoryItem | null> {
    const ns = this.buildNamespace(ctx.workspaceId, namespace, entityId);
    const result = await this.store.get(ns, memoryId);

    return (result?.value as MemoryItem) || null;
  }

  async searchMemories(query: MemorySearchQuery): Promise<MemoryItem[]> {
    const namespaces = query.namespaces || [];
    const results: MemoryItem[] = [];

    if (namespaces.length > 0) {
      for (const ns of namespaces) {
        const namespace = this.buildNamespace(query.workspaceId, ns);
        const nsResults = await this.store.search(namespace, {
          query: query.query,
          limit: query.limit || 20,
        });

        for (const item of nsResults) {
          const memory = item.value as MemoryItem;
          if (this.shouldIncludeMemory(memory, query)) {
            results.push(memory);
          }
        }
      }
    } else {
      const namespace = ['workspaces', query.workspaceId];
      const allResults = await this.store.search(namespace, {
        query: query.query,
        limit: (query.limit || 20) * 2,
      });

      for (const item of allResults) {
        const memory = item.value as MemoryItem;
        if (this.shouldIncludeMemory(memory, query)) {
          results.push(memory);
        }
      }
    }

    return results
      .sort((a, b) => b.importance - a.importance)
      .slice(0, query.limit || 20);
  }

  async searchStore(
    namespace: string[],
    query: string,
    limit = 20,
  ): Promise<Array<{ value: Record<string, unknown> }>> {
    return this.store.search(namespace, { query, limit });
  }

  async listMemories(
    workspaceId: string,
    namespace: MemoryNamespace,
    options?: { limit?: number; includeArchived?: boolean },
  ): Promise<MemoryItem[]> {
    const ns = this.buildNamespace(workspaceId, namespace);
    const limit = options?.limit || 50;

    const results = await this.store.search(ns, {
      query: '',
      limit: limit * 2,
    });

    return results
      .map((item) => item.value as MemoryItem)
      .filter((m) => options?.includeArchived || !m.archivedAt)
      .slice(0, limit);
  }

  async getEntityTimeline(
    workspaceId: string,
    input: {
      entityIds?: string[];
      entityRefs?: EntityRefs;
      namespaces?: MemoryNamespace[];
      limit?: number;
      includeArchived?: boolean;
    },
  ): Promise<MemoryItem[]> {
    const entityIds = (input.entityIds || []).filter(Boolean);
    const entityRefs = input.entityRefs;

    if (
      entityIds.length === 0 &&
      (!entityRefs ||
        (!entityRefs.userIds?.length &&
          !entityRefs.ticketIds?.length &&
          !entityRefs.prIds?.length &&
          !entityRefs.projectIds?.length &&
          !entityRefs.teamIds?.length))
    ) {
      return [];
    }

    const namespaces = input.namespaces ?? MemoryNamespaceSchema.options;
    const limit = input.limit ?? 80;
    const includeArchived = input.includeArchived ?? false;
    const perNamespace = Math.max(
      20,
      Math.ceil((limit / namespaces.length) * 3),
    );

    const allMemories: MemoryItem[] = [];
    for (const namespace of namespaces) {
      const memories = await this.listMemories(workspaceId, namespace, {
        limit: perNamespace,
        includeArchived,
      });
      allMemories.push(...memories);
    }

    const idSet = new Set(entityIds);
    const matchEntityRefs = (values?: string[]) =>
      values?.some((value) => idSet.has(value)) ?? false;
    const matchEntityRefsByKey = (
      values?: string[],
      queryValues?: string[],
    ) =>
      values?.some((value) => queryValues?.includes(value)) ?? false;

    const filtered = allMemories.filter((memory) => {
      if (memory.archivedAt && !includeArchived) {
        return false;
      }

      if (matchEntityRefs(memory.relatedEntityIds)) {
        return true;
      }

      const refs = memory.entityRefs || {};
      return (
        matchEntityRefsByKey(refs.userIds, entityRefs?.userIds) ||
        matchEntityRefsByKey(refs.ticketIds, entityRefs?.ticketIds) ||
        matchEntityRefsByKey(refs.prIds, entityRefs?.prIds) ||
        matchEntityRefsByKey(refs.projectIds, entityRefs?.projectIds) ||
        matchEntityRefsByKey(refs.teamIds, entityRefs?.teamIds)
      );
    });

    return filtered
      .sort(
        (a, b) =>
          this.ensureDate(b.createdAt).getTime() -
          this.ensureDate(a.createdAt).getTime(),
      )
      .slice(0, limit);
  }

  async getRecentBlockers(
    workspaceId: string,
    limit = 10,
  ): Promise<MemoryItem[]> {
    const ns = this.buildNamespace(workspaceId, 'blocker');
    const results = await this.store.search(ns, {
      query: 'blocker blocked blocking',
      limit: limit * 2,
    });

    return results
      .map((item) => item.value as MemoryItem)
      .filter((m) => !m.archivedAt)
      .slice(0, limit);
  }

  async getRecentDecisions(
    workspaceId: string,
    limit = 10,
  ): Promise<MemoryItem[]> {
    const ns = this.buildNamespace(workspaceId, 'decision');
    const results = await this.store.search(ns, {
      query: 'decision decided chose',
      limit: limit * 2,
    });

    return results
      .map((item) => item.value as MemoryItem)
      .filter((m) => !m.archivedAt)
      .slice(0, limit);
  }

  async backfillMemoryFiles(
    workspaceId: string,
    options?: { limitPerNamespace?: number },
  ): Promise<{ namespaces: number; memories: number }> {
    const limit = options?.limitPerNamespace ?? 200;
    let total = 0;

    for (const ns of MemoryNamespaceSchema.options) {
      const memories = await this.listMemories(workspaceId, ns, { limit });
      for (const memory of memories) {
        await this.upsertMemoryFile(workspaceId, memory);
        total += 1;
      }
    }

    return { namespaces: MemoryNamespaceSchema.options.length, memories: total };
  }

  async archiveOnboardingMemories(
    ctx: GraphContext,
    platform: 'slack' | 'linear' | 'github',
    options?: { limit?: number },
  ): Promise<{ scanned: number; archived: number }> {
    const limit = options?.limit ?? 2000;
    const platformLabel =
      platform === 'github' ? 'GitHub' : platform === 'slack' ? 'Slack' : 'Linear';
    const queries = [platformLabel, platform, 'onboarding'];
    const namespaces = MemoryNamespaceSchema.options;
    let scanned = 0;
    let archived = 0;

    for (const ns of namespaces) {
      const namespace = this.buildNamespace(ctx.workspaceId, ns);
      const candidates = new Map<string, MemoryItem>();

      for (const query of queries) {
        const results = await this.store.search(namespace, { query, limit });
        for (const item of results) {
          const memory = item.value as MemoryItem;
          if (memory?.id) {
            candidates.set(memory.id, memory);
          }
        }
      }

      for (const memory of candidates.values()) {
        scanned += 1;
        if (!this.isOnboardingMemory(memory, platform)) {
          continue;
        }

        const updated = await this.updateMemory(
          ctx,
          memory.id,
          memory.namespace ?? ns,
          { archivedAt: new Date() },
        );
        if (updated) {
          archived += 1;
        }
      }
    }

    return { scanned, archived };
  }

  private shouldIncludeMemory(
    memory: MemoryItem,
    query: MemorySearchQuery,
  ): boolean {
    if (!query.includeArchived && memory.archivedAt) {
      return false;
    }

    if (query.categories && !query.categories.includes(memory.category)) {
      return false;
    }

    return !(query.minImportance && memory.importance < query.minImportance);
  }

  private async upsertMemoryFile(
    workspaceId: string,
    memory: MemoryItem,
  ): Promise<void> {
    try {
      const namespace = this.buildFilesystemNamespace(workspaceId);
      const memoryNamespace = memory.namespace || 'workspace';
      const filePath = `/memories/${memoryNamespace}/${memory.id}.md`;
      const content = this.formatMemoryMarkdown(memory);
      const now = new Date();
      const createdAt = this.ensureDate(memory.createdAt || now);
      const updatedAt = this.ensureDate(memory.updatedAt || now);

      await this.store.put(namespace, filePath, {
        content: content.split('\n'),
        created_at: createdAt.toISOString(),
        modified_at: updatedAt.toISOString(),
      });
    } catch (error) {
      this.logger.warn(
        { err: error, memoryId: memory.id, workspaceId },
        '[MemoryService] Failed to sync memory file',
      );
    }
  }

  private buildFilesystemNamespace(workspaceId: string): string[] {
    return [workspaceId, 'filesystem'];
  }

  private formatMemoryMarkdown(memory: MemoryItem): string {
    const metadata = [
      `id: ${memory.id}`,
      `namespace: ${memory.namespace}`,
      `category: ${memory.category}`,
      `importance: ${memory.importance}`,
      `confidence: ${memory.confidence}`,
      `createdAt: ${this.ensureDate(memory.createdAt).toISOString()}`,
      `updatedAt: ${this.ensureDate(memory.updatedAt).toISOString()}`,
      memory.archivedAt
        ? `archivedAt: ${this.ensureDate(memory.archivedAt).toISOString()}`
        : null,
      memory.expiresAt
        ? `expiresAt: ${this.ensureDate(memory.expiresAt).toISOString()}`
        : null,
      `sourceEventIds: ${JSON.stringify(memory.sourceEventIds ?? [])}`,
      `relatedEntityIds: ${JSON.stringify(memory.relatedEntityIds ?? [])}`,
      `relatedMemoryIds: ${JSON.stringify(memory.relatedMemoryIds ?? [])}`,
      `entityRefs: ${JSON.stringify(memory.entityRefs ?? {})}`,
    ]
      .filter(Boolean)
      .join('\n');

    return `---\n${metadata}\n---\n\nSummary:\n${memory.summary}\n\nContent:\n${memory.content}\n`;
  }

  private ensureDate(value: Date | string): Date {
    if (value instanceof Date) {
      return value;
    }
    return new Date(value);
  }

  private isOnboardingMemory(
    memory: MemoryItem,
    platform: 'slack' | 'linear' | 'github',
  ): boolean {
    if (!memory) {
      return false;
    }

    const content = memory.content || '';
    const summary = memory.summary || '';
    const platformLabel =
      platform === 'github' ? 'GitHub' : platform === 'slack' ? 'Slack' : 'Linear';

    if (summary.includes('[Onboarding]') && summary.includes(platformLabel)) {
      return true;
    }

    if (summary.toLowerCase().includes(`${platformLabel.toLowerCase()} onboarding`)) {
      return true;
    }

    if (summary.includes(`${platformLabel} workspace`)) {
      return true;
    }

    if (summary.includes(`${platformLabel} repositories`)) {
      return true;
    }

    if (summary.includes('Linear organization') && platform === 'linear') {
      return true;
    }

    if (summary.includes('Linear onboarding') && platform === 'linear') {
      return true;
    }

    const parsed = this.tryParseJson(content);
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const source = typeof record.source === 'string' ? record.source : '';
      const parsedPlatform =
        typeof record.platform === 'string' ? record.platform : '';
      const type = typeof record.type === 'string' ? record.type : '';

      if (source === 'onboarding' && parsedPlatform === platform) {
        return true;
      }

      if (platform === 'linear' && type.startsWith('linear_')) {
        return true;
      }
    }

    return false;
  }

  private tryParseJson(value: string): unknown | null {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}
