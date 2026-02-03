import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  RequestMethod,
  Sse,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { RunsInvokePayload } from '@langchain/langgraph-sdk';

import { AgentFactory } from './services/agent.factory';
import {
  AuthenticatedUser,
  AuthenticatedWorkspace,
  CurrentUser,
  CurrentWorkspace,
} from '@launchline/core-common';
import { catchError, from, map, Observable, of } from 'rxjs';
import { LangChainMessage } from '@assistant-ui/react-langgraph';
import { AssistantService } from './assistant.service';
import { randomUUID } from 'crypto';
import { StateSnapshot } from '@langchain/langgraph';
import { AgentPromptService } from './services';
import type { StoredThread } from './types';
import { DeepAgent } from 'deepagents';

function buildInboxContextMessage(thread: StoredThread): LangChainMessage {
  const lines: string[] = [
    'Inbox item context:',
    `Title: ${thread.title || 'Untitled'}`,
    `Summary: ${thread.summary || 'No summary available.'}`,
    `Type: ${thread.inboxItemType || 'unknown'}`,
    `Priority: ${thread.inboxPriority || 'unspecified'}`,
  ];

  if (thread.inboxStatus) {
    lines.push(`Status: ${thread.inboxStatus}`);
  }

  if (thread.projectId) {
    lines.push(`Project ID: ${thread.projectId}`);
  }

  if (thread.featureId) {
    lines.push(`Feature ID: ${thread.featureId}`);
  }

  if (thread.entityRefs?.ticketIds?.length) {
    lines.push(`Related tickets: ${thread.entityRefs.ticketIds.join(', ')}`);
  }

  if (thread.entityRefs?.prIds?.length) {
    lines.push(`Related PRs: ${thread.entityRefs.prIds.join(', ')}`);
  }

  if (thread.entityRefs?.userIds?.length) {
    lines.push(`Related users: ${thread.entityRefs.userIds.join(', ')}`);
  }

  if (thread.entityRefs?.teamIds?.length) {
    lines.push(`Related teams: ${thread.entityRefs.teamIds.join(', ')}`);
  }

  if (thread.sourceMemoryIds?.length) {
    lines.push(`Source memories: ${thread.sourceMemoryIds.join(', ')}`);
  }

  lines.push(
    'Use this context to answer questions about this inbox item. If you need more detail, ask the user or use tools to fetch related data.',
  );

  return {
    type: 'system',
    content: lines.join('\n'),
  };
}

async function hasThreadHistory(
  agent: DeepAgent,
  threadId: string,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  try {
    const state = await agent.graph.getState({
      configurable: {
        thread_id: threadId,
        workspaceId,
        userId,
      },
    });
    const messages = (state?.values as { messages?: unknown[] })?.messages;
    return Array.isArray(messages) && messages.length > 0;
  } catch {
    return false;
  }
}

@Controller({ path: 'assistant', version: VERSION_NEUTRAL })
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

  constructor(
    private readonly agentFactory: AgentFactory,
    private readonly assistantService: AssistantService,
    private readonly agentPromptService: AgentPromptService,
  ) {}

  @Sse('stream', { method: RequestMethod.POST })
  async streamAgent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Body() streamPayload: RunsInvokePayload,
    @Query('threadId') threadId?: string,
  ): Promise<Observable<unknown>> {
    if (
      !streamPayload.input ||
      !Array.isArray(streamPayload.input['messages'])
    ) {
      this.logger.error(
        {
          userId: currentUser.userId,
          threadId,
          streamPayload,
        },
        'Invalid input payload for agent stream',
      );

      throw new BadRequestException('Invalid input payload');
    }

    const messages = streamPayload.input['messages'] as LangChainMessage[];
    let currentThreadId = threadId;

    if (!currentThreadId) {
      currentThreadId = randomUUID();

      await this.assistantService.initializeThread(
        workspace.id,
        currentUser.userId,
        currentThreadId,
      );
    }

    const agent = await this.agentFactory.getAgentForWorkspace(workspace.id);
    let enrichedMessages = messages;

    const thread = await this.assistantService.getThread(currentThreadId);
    const hasHistory = await hasThreadHistory(
      agent,
      currentThreadId,
      workspace.id,
      currentUser.userId,
    );

    if (thread?.isInboxThread && thread.workspaceId === workspace.id) {
      const alreadyInjected = messages.some(
        (message) =>
          message.type === 'system' &&
          typeof message.content === 'string' &&
          message.content.includes('Inbox item context:'),
      );

      if (!hasHistory && !alreadyInjected) {
        enrichedMessages = [buildInboxContextMessage(thread), ...messages];
        this.logger.debug(
          { threadId: currentThreadId, workspaceId: workspace.id },
          'Injected inbox context for thread',
        );
      }
    }

    const agentStream = await agent.stream(
      {
        messages: enrichedMessages,
      },
      {
        configurable: {
          thread_id: currentThreadId,
          workspaceId: workspace.id,
          userId: currentUser.userId,
        },
        streamMode: ['messages', 'updates'],
        recursionLimit: 200,
        // subgraphs works but for some reason not typed?
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        subgraphs: true,
      },
    );

    return from(agentStream).pipe(
      map((chunk) => {
        if (ArrayBuffer.isView(chunk) || !chunk) {
          throw new BadRequestException();
        }

        const [_, type, data] = chunk as unknown as [
          [string],
          (typeof chunk)[0],
          (typeof chunk)[1],
        ];

        switch (type) {
          default:
            return {
              type,
              data,
            };
        }
      }),
      catchError((error) => {
        this.logger.error(
          {
            error,
            userId: currentUser.userId,
            threadId: currentThreadId,
          },
          'Error in agent stream',
        );

        return of({
          type: 'messages/partial',
          data: [],
        });
      }),
    );
  }

  @Get('/prompt')
  async getWorkspacePrompt(
    @CurrentUser() currentUser: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
  ): Promise<{ prompt: string | null }> {
    const prompt = await this.agentPromptService.getWorkspacePrompt(
      workspace.id,
    );

    return { prompt };
  }

  @Post('/prompt')
  async updateWorkspacePrompt(
    @CurrentUser() currentUser: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Body() payload: { prompt?: string },
  ): Promise<{ prompt: string }> {
    if (!payload?.prompt || typeof payload.prompt !== 'string') {
      throw new BadRequestException('Prompt is required');
    }

    const trimmedPrompt = payload.prompt.trim();
    if (!trimmedPrompt) {
      throw new BadRequestException('Prompt cannot be empty');
    }

    await this.agentPromptService.upsertWorkspacePrompt(
      workspace.id,
      trimmedPrompt,
      currentUser.userId,
    );

    return { prompt: trimmedPrompt };
  }

  @Get('/thread/:threadId/state')
  async getThreadState(
    @CurrentUser() currentUser: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Query('threadId') threadId: string,
  ): Promise<StateSnapshot> {
    const agent = await this.agentFactory.getAgentForWorkspace(workspace.id);
    return agent.graph.getState({
      configurable: {
        thread_id: threadId,
        workspaceId: workspace.id,
        userId: currentUser.userId,
      },
    });
  }
}
