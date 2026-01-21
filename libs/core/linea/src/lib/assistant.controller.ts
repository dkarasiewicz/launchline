import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  Query,
  RequestMethod,
  Sse,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { WorkspaceFacade } from '@launchline/core-workspace';
import { RunsInvokePayload } from '@langchain/langgraph-sdk';

import { LINEA_AGENT } from './tokens';
import { ReactAgent } from 'langchain';
import { AuthenticatedUser, CurrentUser } from '@launchline/core-common';
import { catchError, from, map, Observable, of } from 'rxjs';
import { LangChainMessage } from '@assistant-ui/react-langgraph';
import { AssistantService } from './assistant.service';
import { randomUUID } from 'crypto';
import { StateSnapshot } from '@langchain/langgraph';

@Controller({ path: 'assistant', version: VERSION_NEUTRAL })
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

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
        streamMode: ['messages', 'updates'],
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-expect-error
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

  @Get('/thread/:threadId/state')
  async getThreadState(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('threadId') threadId: string,
  ): Promise<StateSnapshot> {
    const workspace = await this.workspaceFacade.getWorkspaceByUserId(
      currentUser.userId,
    );

    return this.agent.graph.getState({
      configurable: {
        thread_id: threadId,
        workspaceId: workspace.id,
        userId: currentUser.userId,
      },
    });
  }
}
