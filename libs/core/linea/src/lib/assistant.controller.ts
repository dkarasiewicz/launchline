import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Query,
  RequestMethod,
  Sse,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { WorkspaceFacade } from '@launchline/core-workspace';
import { RunsInvokePayload, ThreadState } from '@langchain/langgraph-sdk';

import { LINEA_AGENT } from './tokens';
import { ReactAgent, AIMessageChunk } from 'langchain';
import { AuthenticatedUser, CurrentUser } from '@launchline/core-common';
import { from, map, Observable } from 'rxjs';
import { LangChainMessage } from '@assistant-ui/react-langgraph';
import { AssistantService } from './assistant.service';
import { randomUUID } from 'crypto';

@Controller({ path: 'assistant', version: VERSION_NEUTRAL })
export class AssistantController {
  constructor(
    @Inject(LINEA_AGENT)
    private readonly agent: ReactAgent,
    private readonly workspaceFacade: WorkspaceFacade,
    private readonly assistantService: AssistantService,
  ) {}

  @Sse('stream', { method: RequestMethod.POST })
  async streamAgent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() streamPayload: RunsInvokePayload,
    @Query('threadId') threadId?: string,
  ): Promise<Observable<unknown>> {
    const workspace = await this.workspaceFacade.getWorkspaceByUserId(
      currentUser.userId,
    );

    if (
      !streamPayload.input ||
      !Array.isArray(streamPayload.input['messages'])
    ) {
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

    const agentStream = await this.agent.stream(
      {
        messages,
      },
      {
        configurable: {
          thread_id: currentThreadId,
          workspaceId: workspace.id,
          userId: currentUser.userId,
        },
        streamMode: 'messages',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-expect-error
        subgraphs: true,
      },
    );

    return from(agentStream).pipe(
      map((chunk) => {
        const [type, data] = (chunk as unknown as [string, unknown[]]) || [
          '',
          [],
        ];

        if (AIMessageChunk.isInstance(data[0])) {
          const aiChunk = data[0] as AIMessageChunk;

          return {
            type: 'messages',
            data: [
              {
                id: aiChunk.id,
                type: 'AIMessageChunk',
                content: aiChunk.content,
                tool_call_chunks: aiChunk.tool_call_chunks,
              },
            ],
          };
        }

        return {
          type,
          data,
        };
      }),
    );
  }

  @Get('/thread/:threadId/state')
  async getThreadState(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('threadId') threadId: string,
  ): Promise<ThreadState<Record<string, unknown>>> {
    const workspace = await this.workspaceFacade.getWorkspaceByUserId(
      currentUser.userId,
    );

    return this.agent.getState({
      configurable: {
        thread_id: threadId,
        workspaceId: workspace.id,
        userId: currentUser.userId,
      },
    });
  }
}
