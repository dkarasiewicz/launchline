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

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

interface LaunchlineRuntimeProviderProps {
  children: ReactNode;
}

/**
 * Stream messages to a thread using SSE endpoint
 */
async function* streamMessages({
  threadId,
  messages,
  abortSignal,
}: {
  threadId: string;
  messages: LangChainMessage[];
  abortSignal?: AbortSignal;
}): AsyncGenerator<LangGraphMessagesEvent<LangChainMessage>> {
  const url = `${API_BASE}/assistant/stream?threadId=${threadId.trim()}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: { messages } }),
    credentials: 'include',
    signal: abortSignal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to stream messages: ${response.statusText}`);
  }

  const stream = response.body
    .pipeThrough(BytesLineDecoder())
    .pipeThrough(SSEDecoder());

  const reader = stream.getReader();
  const getConstructorName = (
    raw: SerializedConstructor | Record<string, unknown>,
  ): string | null => {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as SerializedConstructor;
    if (candidate.lc === 1 && Array.isArray(candidate.id)) {
      return candidate.id.at(-1) ?? null;
    }

    return null;
  };
  const parseMessage = (
    raw: SerializedConstructor | Record<string, unknown>,
  ): LangChainMessage | null => {
    try {
      const parsed = constructMessageFromParams(raw as SerializedConstructor);
      const constructorName = getConstructorName(raw);
      if (constructorName && constructorName.endsWith('MessageChunk')) {
        parsed.type = constructorName as typeof parsed.type;
      }
      return parsed;
    } catch (error) {
      console.warn('[LaunchlineRuntime] Failed to parse stream message', error);
      return null;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      if (!value) continue;

      switch (value.event) {
        case 'messages':
        case 'messages-tuple': {
          const tuple = Array.isArray(value.data) ? value.data : null;
          const rawMessage = tuple?.[0] ?? value.data;
          const parsedMessage = parseMessage(
            rawMessage as SerializedConstructor,
          );

          if (
            !parsedMessage ||
            !['ai', 'assistant', 'AIMessageChunk'].includes(parsedMessage.type)
          ) {
            continue;
          }

          if (parsedMessage.type === 'AIMessageChunk') {
            yield {
              event: 'messages',
              data: [
                parsedMessage,
                (tuple?.[1] ?? {}) as Record<string, unknown>,
              ],
            };
          } else {
            yield {
              event: 'messages/partial',
              data: [parsedMessage],
            };
          }
          break;
        }
        case 'messages/partial':
        case 'messages/complete': {
          if (!Array.isArray(value.data)) {
            break;
          }

          const parsedMessages = value.data
            .map((message) =>
              parseMessage(
                message as SerializedConstructor | Record<string, unknown>,
              ),
            )
            .filter(
              (message): message is LangChainMessage =>
                !!message &&
                ['ai', 'tool', 'human', 'system', 'AIMessageChunk'].includes(
                  message.type,
                ),
            );

          if (parsedMessages.length === 0) {
            break;
          }

          yield {
            event: value.event,
            data: parsedMessages,
          };
          break;
        }
        case 'updates': {
          const updatePayload = value.data as Record<string, unknown>;

          if (!updatePayload || typeof updatePayload !== 'object') {
            break;
          }

          const allowedKeys = new Set(['model_request', 'tools']);
          const updateKeys = Object.keys(updatePayload);
          const hasAllowedKey = updateKeys.some((key) => allowedKeys.has(key));
          if (!hasAllowedKey) {
            break;
          }

          const messagesBatch: LangChainMessage[] = [];
          let interrupts: unknown[] | undefined;

          const entries = Object.entries(updatePayload).filter(
            ([key, value]) => value !== undefined && allowedKeys.has(key),
          );
          const sortedEntries = [
            ...entries.filter(([key]) => key !== 'tools'),
            ...entries.filter(([key]) => key === 'tools'),
          ];

          for (const [, update] of sortedEntries) {
            const payload = update as
              | {
                  messages?: SerializedConstructor[];
                  __interrupt__?: unknown[];
                }
              | undefined;

            if (!payload || typeof payload !== 'object') {
              continue;
            }

            if (Array.isArray(payload.__interrupt__)) {
              interrupts = payload.__interrupt__;
            }

            if (Array.isArray(payload.messages)) {
              const parsedMessages = payload.messages
                .map((message) =>
                  parseMessage(
                    message as SerializedConstructor | Record<string, unknown>,
                  ),
                )
                .filter(
                  (message): message is LangChainMessage =>
                    !!message &&
                    ['ai', 'tool', 'human', 'system', 'AIMessageChunk'].includes(
                      message.type,
                    ),
                );
              messagesBatch.push(...parsedMessages);
            }
          }

          if (messagesBatch.length > 0) {
            yield {
              event: 'messages/partial',
              data: messagesBatch,
            };
          }

          if (interrupts && interrupts.length > 0) {
            yield {
              event: 'updates',
              data: { __interrupt__: interrupts },
            };
          }
          break;
        }
        default:
          if (value.event && value.data !== undefined) {
            yield {
              event: value.event,
              data: value.data,
            } as LangGraphMessagesEvent<LangChainMessage>;
          } else {
            console.warn(`Unknown event type: ${value}`);
          }
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
        stream: async function* (messages, { initialize, abortSignal }) {
          const data = await initialize();
          const { remoteId } = data;

          if (!remoteId) throw new Error('Thread not initialized');

          const generator = streamMessages({
            threadId: remoteId,
            messages,
            abortSignal,
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
