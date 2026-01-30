import {
  Args,
  Context,
  Mutation,
  Query,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import {
  AuthenticatedUser,
  AuthenticatedWorkspace,
  CurrentUser,
  CurrentWorkspace,
  PUB_SUB,
} from '@launchline/core-common';
import type { RedisPubSub } from 'graphql-redis-subscriptions';
import { AssistantService } from './assistant.service';
import {
  Thread,
  ThreadStatus,
  ThreadListResponse,
  InitializeThreadResponse,
  InitializeThreadInput,
  RenameThreadInput,
  GenerateTitleInput,
  InboxItemType,
  InboxPriority,
  InboxStatus,
  LineaChangeEvent,
} from './thread.models';
import { LineaEvents } from './linea.events';
import { PubSubAsyncIterator } from 'graphql-redis-subscriptions/dist/pubsub-async-iterator';

@Resolver(() => Thread)
export class ThreadResolver {
  private readonly logger = new Logger(ThreadResolver.name);

  constructor(
    private readonly assistantService: AssistantService,
    @Inject(PUB_SUB) private readonly pubSub: RedisPubSub,
  ) {}

  @Query(() => ThreadListResponse)
  async threads(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
  ): Promise<ThreadListResponse> {
    this.logger.debug(`Listing threads for user: ${user.userId}`);

    const result = await this.assistantService.listThreads(
      workspace.id,
      user.userId,
    );

    return {
      threads: result.threads.map((t) => ({
        remoteId: t.remoteId,
        status:
          t.status === 'archived'
            ? ThreadStatus.ARCHIVED
            : ThreadStatus.REGULAR,
        title: t.title,
        createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
        isInboxThread: t.isInboxThread,
        inboxItemType: t.inboxItemType as InboxItemType,
        inboxPriority: t.inboxPriority as InboxPriority,
        inboxStatus: t.inboxStatus as InboxStatus,
        summary: t.summary,
        projectId: t.projectId,
        featureId: t.featureId,
      })),
    };
  }

  @Query(() => Thread, { nullable: true })
  async thread(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('threadId') threadId: string,
  ): Promise<Thread | null> {
    this.logger.debug(`Fetching thread: ${threadId} for user: ${user.userId}`);

    const storedThread = await this.assistantService.getThread(threadId);

    if (!storedThread) {
      return null;
    }

    // Verify user has access to this thread
    if (storedThread.workspaceId !== workspace.id) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    return {
      remoteId: storedThread.id,
      status: storedThread.archived
        ? ThreadStatus.ARCHIVED
        : ThreadStatus.REGULAR,
      title: storedThread.title,
      createdAt: storedThread.createdAt
        ? new Date(storedThread.createdAt)
        : undefined,
      updatedAt: storedThread.updatedAt
        ? new Date(storedThread.updatedAt)
        : undefined,
      isInboxThread: storedThread.isInboxThread,
      inboxItemType: storedThread.inboxItemType as InboxItemType,
      inboxPriority: storedThread.inboxPriority as InboxPriority,
      inboxStatus: storedThread.inboxStatus as InboxStatus,
      summary: storedThread.summary,
      projectId: storedThread.projectId,
      featureId: storedThread.featureId,
    };
  }

  @Mutation(() => InitializeThreadResponse)
  async initializeThread(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('input') input: InitializeThreadInput,
  ): Promise<InitializeThreadResponse> {
    this.logger.debug(
      `Initializing thread: ${input.threadId} for user: ${user.userId}`,
    );
    const result = await this.assistantService.initializeThread(
      workspace.id,
      user.userId,
      input.threadId,
    );

    return {
      remoteId: result.remoteId,
      externalId: result.remoteId,
    };
  }

  @Mutation(() => Boolean)
  async renameThread(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: RenameThreadInput,
  ): Promise<boolean> {
    this.logger.debug(`Renaming thread: ${input.threadId}`);

    await this.assistantService.renameThread(input.threadId, input.newTitle);
    return true;
  }

  @Mutation(() => Boolean)
  async deleteThread(
    @CurrentUser() user: AuthenticatedUser,
    @Args('threadId') threadId: string,
  ): Promise<boolean> {
    this.logger.debug(`Deleting thread: ${threadId}`);

    await this.assistantService.deleteThread(threadId);
    return true;
  }

  @Mutation(() => Boolean)
  async archiveThread(
    @CurrentUser() user: AuthenticatedUser,
    @Args('threadId') threadId: string,
  ): Promise<boolean> {
    this.logger.debug(`Archiving thread: ${threadId}`);

    await this.assistantService.archiveThread(threadId);
    return true;
  }

  @Mutation(() => Boolean)
  async unarchiveThread(
    @CurrentUser() user: AuthenticatedUser,
    @Args('threadId') threadId: string,
  ): Promise<boolean> {
    this.logger.debug(`Unarchiving thread: ${threadId}`);

    await this.assistantService.unarchiveThread(threadId);
    return true;
  }

  @Mutation(() => String)
  async generateThreadTitle(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: GenerateTitleInput,
  ): Promise<string> {
    this.logger.debug(`Generating title for thread: ${input.threadId}`);

    const messages = input.messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    return this.assistantService.generateTitle(input.threadId, messages);
  }

  @Subscription(() => LineaChangeEvent, {
    nullable: true,
    filter: (payload, _variables, context) => {
      const senderSessionId = payload?.sessionId as string | undefined;
      const receiverSessionId = (context as { sessionId?: string })
        ?.sessionId;

      if (!senderSessionId || !receiverSessionId) {
        return true;
      }

      return senderSessionId !== receiverSessionId;
    },
    resolve: (payload) => {
      if (!payload || !payload.lineaChanged) {
        return null;
      }

      return payload.lineaChanged;
    },
  })
  lineaChanged(
    @Context() _context: Record<string, unknown>,
  ): PubSubAsyncIterator<unknown> {
    return this.pubSub.asyncIterator([LineaEvents.INBOX_ITEM_CREATED]);
  }
}
