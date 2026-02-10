import { Inject, Injectable, Logger } from '@nestjs/common';
import { LINEA_STORE, LINEA_MODEL_FAST } from './tokens';
import { PUB_SUB } from '@launchline/core-common';
import type { RedisPubSub } from 'graphql-redis-subscriptions';
import type { BaseStore } from '@langchain/langgraph';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type {
  MessageDto,
  ThreadDto,
  ThreadListResponseDto,
  StoredThread,
  StoreItem,
  InboxItemCandidate,
  InboxItemType,
  InboxPriority,
  InboxStatus,
} from './types';
import { LineaEvents } from './linea.events';
import { LineaEventType } from './thread.models';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private static readonly DEDUPE_STATUSES = new Set([
    'actioned',
    'dismissed',
    'auto_resolved',
  ]);

  constructor(
    @Inject(LINEA_STORE)
    private readonly store: BaseStore,
    @Inject(LINEA_MODEL_FAST)
    private readonly fastModel: BaseChatModel,
    @Inject(PUB_SUB)
    private readonly pubSub: RedisPubSub,
  ) {}

  async listThreads(
    workspaceId: string,
    userId: string,
  ): Promise<ThreadListResponseDto> {
    const namespace = ['workspaces', workspaceId, 'threads', userId];
    const activeLimit = 1000;
    const archivedLimit = 500;

    try {
      const [activeResults, archivedResults] = await Promise.all([
        this.store.search(namespace, {
          query: '*',
          filter: { archived: false },
          limit: activeLimit,
        }),
        this.store.search(namespace, {
          query: '*',
          filter: { archived: true },
          limit: archivedLimit,
        }),
      ]);

      const results = [...(activeResults || []), ...(archivedResults || [])];

      const threads: ThreadDto[] = (results || []).map((item: StoreItem) => {
        const value = item.value || {};
        return {
          remoteId: (value['id'] as string) || item.key || '',
          status: value['archived'] ? 'archived' : 'regular',
          title: value['title'] as string | undefined,
          createdAt: value['createdAt'] as string | undefined,
          updatedAt: value['updatedAt'] as string | undefined,
          isInboxThread: value['isInboxThread'] as boolean | undefined,
          inboxItemType: value['inboxItemType'] as InboxItemType | undefined,
          inboxPriority: value['inboxPriority'] as InboxPriority | undefined,
          inboxStatus: value['inboxStatus'] as InboxStatus | undefined,
          summary: value['summary'] as string | undefined,
          projectId: value['projectId'] as string | undefined,
          featureId: value['featureId'] as string | undefined,
        };
      });

      const generalThreadId = `general:${workspaceId}:${userId}`;
      const now = new Date().toISOString();
      let generalThread = threads.find(
        (thread) => thread.remoteId === generalThreadId,
      );

      if (!generalThread) {
        const threadRecord: StoredThread = {
          id: generalThreadId,
          workspaceId,
          userId,
          title: 'General',
          archived: false,
          createdAt: now,
          updatedAt: now,
          isInboxThread: false,
        };

        await this.store.put(namespace, generalThreadId, threadRecord);

        threads.push({
          remoteId: generalThreadId,
          status: 'regular',
          title: threadRecord.title,
          createdAt: now,
          updatedAt: now,
          isInboxThread: false,
        });
      } else if (generalThread.status === 'archived') {
        const existing = await this.getThread(generalThreadId);
        const updatedThread: StoredThread = {
          id: generalThreadId,
          workspaceId,
          userId,
          title: existing?.title || 'General',
          archived: false,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          isInboxThread: false,
        };

        await this.store.put(namespace, generalThreadId, updatedThread);

        generalThread = {
          ...generalThread,
          status: 'regular',
          title: updatedThread.title,
          updatedAt: now,
          isInboxThread: false,
        };
      }

      const sortedThreads = threads.sort((a, b) => {
        const aTime = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const bTime = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return bTime - aTime;
      });

      return { threads: sortedThreads };
    } catch (error) {
      this.logger.error({ error }, '[AssistantService] listThreads error:');

      return { threads: [] };
    }
  }

  async initializeThread(
    workspaceId: string,
    userId: string,
    threadId: string,
  ): Promise<{ remoteId: string }> {
    const namespace = ['workspaces', workspaceId, 'threads', userId];

    const thread: StoredThread = {
      id: threadId,
      workspaceId,
      userId,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.store.put(namespace, threadId, thread);

    return { remoteId: threadId };
  }

  async getThread(threadId: string): Promise<StoredThread | null> {
    try {
      const results = await this.store.search(['workspaces'], {
        query: threadId,
        limit: 1,
      });

      if (results && results.length > 0) {
        return results[0].value as unknown as StoredThread;
      }
      return null;
    } catch {
      return null;
    }
  }

  async renameThread(threadId: string, newTitle: string): Promise<void> {
    const thread = await this.getThread(threadId);
    if (!thread) return;

    const namespace = [
      'workspaces',
      thread.workspaceId,
      'threads',
      thread.userId,
    ];

    const updatedThread: StoredThread = {
      ...thread,
      title: newTitle,
      updatedAt: new Date().toISOString(),
    };

    await this.store.put(namespace, threadId, updatedThread);
  }

  async archiveThread(threadId: string): Promise<void> {
    const thread = await this.getThread(threadId);
    if (!thread) return;

    const namespace = [
      'workspaces',
      thread.workspaceId,
      'threads',
      thread.userId,
    ];

    const updatedThread: StoredThread = {
      ...thread,
      archived: true,
      updatedAt: new Date().toISOString(),
    };

    await this.store.put(namespace, threadId, updatedThread);
  }

  async unarchiveThread(threadId: string): Promise<void> {
    const thread = await this.getThread(threadId);
    if (!thread) return;

    const namespace = [
      'workspaces',
      thread.workspaceId,
      'threads',
      thread.userId,
    ];

    const updatedThread: StoredThread = {
      ...thread,
      archived: false,
      updatedAt: new Date().toISOString(),
    };

    await this.store.put(namespace, threadId, updatedThread);
  }

  async deleteThread(threadId: string): Promise<void> {
    const thread = await this.getThread(threadId);
    if (!thread) return;

    // Delete messages first
    const messagesNamespace = [
      'workspaces',
      thread.workspaceId,
      'messages',
      threadId,
    ];

    try {
      const messages = await this.store.search(messagesNamespace, {
        query: '*',
        limit: 1000,
      });

      for (const msg of messages || []) {
        const msgId = msg.key || (msg.value?.['id'] as string);
        if (msgId) {
          await this.store.delete(messagesNamespace, msgId);
        }
      }
    } catch (error) {
      this.logger.error(
        { error },
        '[AssistantService] Error deleting messages:',
      );
    }

    const threadNamespace = [
      'workspaces',
      thread.workspaceId,
      'threads',
      thread.userId,
    ];

    await this.store.delete(threadNamespace, threadId);
  }

  async generateTitle(
    threadId: string,
    messages: MessageDto[],
  ): Promise<string> {
    const prompt = `Generate a very short, concise title (3-6 words) for this conversation. Only respond with the title, nothing else.

Conversation:
${messages
  .slice(0, 5) // Only use first 5 messages
  .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
  .join('\n')}

Title:`;

    try {
      const response = await this.fastModel.invoke(prompt);
      const title =
        (typeof response.content === 'string'
          ? response.content
          : String(response.content)
        ).trim() || 'New Conversation';

      await this.renameThread(threadId, title);

      return title;
    } catch (error) {
      this.logger.error({ error }, '[AssistantService] generateTitle error:');

      return 'New Conversation';
    }
  }

  async createInboxThread(
    workspaceId: string,
    userId: string,
    candidate: InboxItemCandidate,
    sessionId?: string,
  ): Promise<{ remoteId: string }> {
    const namespace = ['workspaces', workspaceId, 'threads', userId];
    const threadId = candidate.id;

    const thread: StoredThread = {
      id: threadId,
      workspaceId,
      userId,
      title: candidate.title,
      archived: false,
      createdAt: candidate.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
      isInboxThread: true,
      inboxItemType: candidate.type,
      inboxPriority: candidate.priority,
      inboxStatus: 'pending',
      summary: candidate.summary,
      sourceMemoryIds: candidate.sourceMemoryIds,
      entityRefs: candidate.entityRefs,
    };

    await this.store.put(namespace, threadId, thread);

    this.logger.debug(
      `Created inbox thread: ${threadId} of type ${candidate.type}`,
    );

    await this.pubSub.publish(LineaEvents.INBOX_ITEM_CREATED, {
      lineaChanged: {
        changedAt: new Date().toISOString(),
        type: LineaEventType.INBOX_ITEM_CREATED,
        id: threadId,
      },
      sessionId,
    });

    return { remoteId: threadId };
  }

  async findRecentInboxThread(input: {
    workspaceId: string;
    userId: string;
    title: string;
    type?: InboxItemType;
    entityRefs?: StoredThread['entityRefs'];
    withinMinutes?: number;
  }): Promise<StoredThread | null> {
    const { workspaceId, userId, title, type, entityRefs } = input;
    const withinMinutes = input.withinMinutes ?? 120;
    const normalizedTitle = this.normalizeInboxText(title);
    if (!normalizedTitle) {
      return null;
    }

    const namespace = ['workspaces', workspaceId, 'threads', userId];
    const cutoff = Date.now() - withinMinutes * 60_000;
    const targetRefs = this.normalizeInboxRefs(entityRefs);

    try {
      const results = await this.store.search(namespace, {
        query: '*',
        filter: { archived: false },
        limit: 500,
      });

      for (const item of results || []) {
        const value = item.value || {};
        if (!value['isInboxThread']) continue;
        if (type && value['inboxItemType'] !== type) continue;

        const status = value['inboxStatus'] as string | undefined;
        if (status && AssistantService.DEDUPE_STATUSES.has(status)) continue;

        const createdAtRaw = value['createdAt'] as string | undefined;
        const createdAt = createdAtRaw
          ? new Date(createdAtRaw).getTime()
          : 0;
        if (!createdAt || createdAt < cutoff) continue;

        const existingTitle = this.normalizeInboxText(
          value['title'] as string | undefined,
        );
        if (!existingTitle || existingTitle !== normalizedTitle) continue;

        if (targetRefs.hasAny) {
          const existingRefs = this.normalizeInboxRefs(
            value['entityRefs'] as StoredThread['entityRefs'],
          );
          if (!this.hasRefOverlap(targetRefs, existingRefs)) continue;
        }

        return value as StoredThread;
      }
    } catch (error) {
      this.logger.error(
        { error, workspaceId, userId },
        '[AssistantService] findRecentInboxThread error:',
      );
    }

    return null;
  }

  private normalizeInboxText(value?: string): string {
    return (value || '').trim().toLowerCase();
  }

  private normalizeInboxRefs(refs?: StoredThread['entityRefs']): {
    ticketIds: Set<string>;
    prIds: Set<string>;
    userIds: Set<string>;
    teamIds: Set<string>;
    hasAny: boolean;
  } {
    const toSet = (values?: string[]) =>
      new Set(
        (values || [])
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean),
      );
    const ticketIds = toSet(refs?.ticketIds);
    const prIds = toSet(refs?.prIds);
    const userIds = toSet(refs?.userIds);
    const teamIds = toSet(refs?.teamIds);
    const hasAny =
      ticketIds.size + prIds.size + userIds.size + teamIds.size > 0;

    return { ticketIds, prIds, userIds, teamIds, hasAny };
  }

  private hasRefOverlap(
    left: ReturnType<AssistantService['normalizeInboxRefs']>,
    right: ReturnType<AssistantService['normalizeInboxRefs']>,
  ): boolean {
    return (
      this.hasSetOverlap(left.ticketIds, right.ticketIds) ||
      this.hasSetOverlap(left.prIds, right.prIds) ||
      this.hasSetOverlap(left.userIds, right.userIds) ||
      this.hasSetOverlap(left.teamIds, right.teamIds)
    );
  }

  private hasSetOverlap(left: Set<string>, right: Set<string>): boolean {
    for (const entry of left) {
      if (right.has(entry)) return true;
    }
    return false;
  }

  async updateInboxStatus(threadId: string, status: string): Promise<void> {
    const thread = await this.getThread(threadId);

    if (!thread || !thread.isInboxThread) {
      this.logger.warn(
        `Cannot update inbox status for non-inbox thread: ${threadId}`,
      );
      return;
    }

    const namespace = [
      'workspaces',
      thread.workspaceId,
      'threads',
      thread.userId,
    ];

    const updatedThread: StoredThread = {
      ...thread,
      inboxStatus: status,
      updatedAt: new Date().toISOString(),
    };

    // Archive thread if status indicates resolution
    if (['actioned', 'auto_resolved', 'dismissed'].includes(status)) {
      updatedThread.archived = true;
    }

    await this.store.put(namespace, threadId, updatedThread);

    this.logger.debug(`Updated inbox thread ${threadId} status to: ${status}`);
  }
}
