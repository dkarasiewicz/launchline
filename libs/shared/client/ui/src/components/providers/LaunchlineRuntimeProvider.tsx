'use client';

import { type ReactNode, useMemo } from 'react';
import {
  AssistantRuntimeProvider,
  unstable_useRemoteThreadListRuntime as useRemoteThreadListRuntime,
} from '@assistant-ui/react';
import {
  type LangChainMessage,
  LangGraphMessagesEvent,
} from '@assistant-ui/react-langgraph';
import { createThreadListAdapter } from '../../lib/assistant/thread-adapter';
import { BytesLineDecoder, SSEDecoder } from './sse';
import { useLangGraphRuntime } from './langraph-runtime';

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
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to stream messages: ${response.statusText}`);
  }

  const stream = response.body
    .pipeThrough(BytesLineDecoder())
    .pipeThrough(SSEDecoder());

  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get thread state from the backend
 */
async function getThreadState(threadId: string) {
  const response = await fetch(
    `${API_BASE}/assistant/thread/${threadId}/state?threadId=${threadId}`,
    {
      method: 'GET',
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

            return {
              messages: (
                (
                  state.values as {
                    messages?: {
                      id: string[];
                      kwargs: {
                        content: string;
                        id: string;
                      };
                    }[];
                  }
                ).messages ?? []
              ).map((msg): LangChainMessage => {
                const isHumanMsg = msg.id.includes('HumanMessage');
                const isAIMessage = msg.id.includes('AIMessageChunk');

                return {
                  id: msg.kwargs.id,
                  type: isHumanMsg ? 'human' : isAIMessage ? 'ai' : 'system',
                  content: msg.kwargs.content,
                };
              }),
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
