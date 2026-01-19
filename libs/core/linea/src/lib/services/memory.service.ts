import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import { randomUUID as uuidv4 } from 'node:crypto';
import { LINEA_STORE } from '../tokens';
import {
  type GraphContext,
  type MemoryItem,
  type MemoryItemInput,
  MemoryItemInputSchema,
  type MemoryNamespace,
  type MemorySearchQuery,
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
}
