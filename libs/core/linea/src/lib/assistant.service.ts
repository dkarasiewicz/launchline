import { Inject, Injectable, Logger } from '@nestjs/common';
import { LINEA_STORE, LINEA_MODEL_FAST } from './tokens';
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

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    @Inject(LINEA_STORE)
    private readonly store: BaseStore,
    @Inject(LINEA_MODEL_FAST)
    private readonly fastModel: BaseChatModel,
  ) {}

  async listThreads(
    workspaceId: string,
    userId: string,
  ): Promise<ThreadListResponseDto> {
    const namespace = ['workspaces', workspaceId, 'threads', userId];

    try {
      const results = await this.store.search(namespace, {
        query: '*',
        limit: 100,
      });

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

      return { threads };
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

    return { remoteId: threadId };
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
