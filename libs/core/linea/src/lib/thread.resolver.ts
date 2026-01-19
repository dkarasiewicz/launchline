import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '@launchline/core-common';
import { WorkspaceFacade } from '@launchline/core-workspace';
import { AssistantService } from './assistant.service';
import {
  Thread,
  ThreadStatus,
  ThreadListResponse,
  InitializeThreadResponse,
  InitializeThreadInput,
  RenameThreadInput,
  GenerateTitleInput,
} from './thread.models';

@Resolver(() => Thread)
export class ThreadResolver {
  private readonly logger = new Logger(ThreadResolver.name);

  constructor(
    private readonly assistantService: AssistantService,
    private readonly workspaceFacade: WorkspaceFacade,
  ) {}

  @Query(() => ThreadListResponse)
  async threads(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ThreadListResponse> {
    this.logger.debug(`Listing threads for user: ${user.userId}`);

    const workspace = await this.workspaceFacade.getWorkspaceByUserId(
      user.userId,
    );
    const result = await this.assistantService.listThreads(
      workspace.id,
      user.userId,
    );

    return {
      threads: result.threads.map(
        (t: { remoteId: string; status: string; title?: string }) => ({
          remoteId: t.remoteId,
          status:
            t.status === 'archived'
              ? ThreadStatus.ARCHIVED
              : ThreadStatus.REGULAR,
          title: t.title,
        }),
      ),
    };
  }

  @Mutation(() => InitializeThreadResponse)
  async initializeThread(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: InitializeThreadInput,
  ): Promise<InitializeThreadResponse> {
    this.logger.debug(
      `Initializing thread: ${input.threadId} for user: ${user.userId}`,
    );

    const workspace = await this.workspaceFacade.getWorkspaceByUserId(
      user.userId,
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
}
