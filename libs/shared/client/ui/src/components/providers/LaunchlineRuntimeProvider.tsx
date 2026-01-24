'use client';

import { type ReactNode, useMemo } from 'react';
import {
  AssistantRuntimeProvider,
  unstable_useRemoteThreadListRuntime as useRemoteThreadListRuntime,
} from '@assistant-ui/react';
import {
  type LangChainMessage,
  LangGraphMessagesEvent,
  useLangGraphRuntime,
} from '@assistant-ui/react-langgraph';
import { createThreadListAdapter } from '../../lib/assistant/thread-adapter';
import { BytesLineDecoder, SSEDecoder } from './sse';
import { ThreadState } from '@langchain/langgraph-sdk';
import { constructMessageFromParams } from './langchain-utils';
import { type SerializedConstructor } from '@langchain/core/load/serializable';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface LaunchlineRuntimeProviderProps {
  children: ReactNode;
}

/**
 * Stream messages to a thread using SSE endpoint
 */
async function* streamMessages({
  threadId,
  messages,
}: {
  threadId: string;
  messages: LangChainMessage[];
}): AsyncGenerator<LangGraphMessagesEvent<LangChainMessage>> {
  const url = `${API_BASE}/assistant/stream?threadId=${threadId.trim()}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: { messages } }),
    credentials: 'include',
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to stream messages: ${response.statusText}`);
  }

  const stream = response.body.pipeThrough(BytesLineDecoder()).pipeThrough<
    | {
        data: [SerializedConstructor, Record<string, unknown>];
        event: 'messages';
      }
    | {
        data: Record<string, unknown>;
        event: 'updates';
      }
  >(SSEDecoder());

  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      if (!value) continue;

      switch (value.event) {
        case 'messages': {
          const parsedMessage = constructMessageFromParams(value.data[0]);

          if (parsedMessage.type !== 'ai') {
            continue;
          }

          parsedMessage.type = 'AIMessageChunk' as 'ai'; // Mark as chunk

          yield {
            event: 'messages',
            data: [parsedMessage, value.data[1]],
          };
          break;
        }
        case 'updates': {
          if (value.data.__interrupt__) {
            yield {
              event: 'updates',
              data: value.data,
            };

            break;
          }

          const rawUpdate = value.data[Object.keys(value.data)[0]] as {
            messages?: SerializedConstructor[];
            __interrupt__?: unknown[];
          };
          const parsedUpdate: {
            messages?: LangChainMessage[];
            __interrupt__?: unknown[];
          } = {};

          parsedUpdate.__interrupt__ = rawUpdate.__interrupt__;

          if (rawUpdate.messages) {
            parsedUpdate.messages = rawUpdate.messages.map(
              constructMessageFromParams,
            ) as LangChainMessage[];
          }

          yield {
            event: 'updates',
            data: parsedUpdate,
          };
          break;
        }
        default:
          console.warn(`Unknown event type: ${value}`);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get thread state from the backend
 */
async function getThreadState(threadId: string): Promise<
  ThreadState<{
    messages: SerializedConstructor[];
  }>
> {
  const response = await fetch(
    `${API_BASE}/assistant/thread/${threadId}/state?threadId=${threadId}`,
    {
      method: 'GET',
      credentials: 'include',
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get thread state: ${response.statusText}`);
  }

  return response.json();
}

export function LaunchlineRuntimeProvider({
  children,
}: LaunchlineRuntimeProviderProps) {
  const threadListAdapter = useMemo(() => createThreadListAdapter(), []);

  const runtime = useRemoteThreadListRuntime({
    runtimeHook: () =>
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useLangGraphRuntime({
        stream: async function* (messages, { initialize }) {
          const data = await initialize();
          const { remoteId } = data;

          if (!remoteId) throw new Error('Thread not initialized');

          const generator = streamMessages({
            threadId: remoteId,
            messages,
          });

          yield* generator;
        },
        load: async (externalId) => {
          try {
            const state = await getThreadState(externalId);

            const messages = state.values.messages?.map(
              constructMessageFromParams,
            ) as LangChainMessage[];

            return {
              messages: (messages ?? []).filter((message) =>
                ['ai', 'tool', 'human', 'system'].includes(message.type),
              ),
              interrupts: state.tasks?.[0]?.interrupts ?? [],
            };
          } catch (error) {
            console.error('[LaunchlineRuntime] Failed to load thread:', error);

            return {
              messages: [],
              interrupts: [],
            };
          }
        },
      }),
    adapter: threadListAdapter,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

export type { LangChainMessage } from '@assistant-ui/react-langgraph';
