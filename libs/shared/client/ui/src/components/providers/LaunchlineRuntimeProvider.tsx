'use client';

import { ReactNode, useState, useCallback, useMemo, useRef } from 'react';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
} from '@assistant-ui/react';
import {
  createThread,
  getMessages,
  streamMessage,
  addToolResult,
  ThreadMessage,
  MessageContent,
  TextContent,
  ToolCallContent,
} from '../../lib/launchlineApi';

// ============================================================================
// Internal Message Type with mutable content
// ============================================================================

interface InternalMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: Array<{
    type: 'text' | 'tool-call';
    text?: string;
    toolCallId?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    result?: unknown;
  }>;
  createdAt: Date;
}

// ============================================================================
// Message Conversion
// ============================================================================

function convertToInternalMessage(msg: ThreadMessage): InternalMessage {
  const content: InternalMessage['content'] = [];

  for (const part of msg.content) {
    switch (part.type) {
      case 'text':
        content.push({ type: 'text', text: (part as TextContent).text });
        break;
      case 'tool-call': {
        const toolCall = part as ToolCallContent;
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          args: toolCall.args,
          result: toolCall.result,
        });
        break;
      }
    }
  }

  return {
    id: msg.id,
    role:
      msg.role === 'tool'
        ? 'assistant'
        : (msg.role as 'user' | 'assistant' | 'system'),
    content,
    createdAt: new Date(msg.createdAt),
  };
}

function convertToThreadMessageLike(msg: InternalMessage): ThreadMessageLike {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content.map((c) => {
      if (c.type === 'text') {
        return { type: 'text' as const, text: c.text || '' };
      }
      return {
        type: 'tool-call' as const,
        toolCallId: c.toolCallId || '',
        toolName: c.toolName || '',
        args: c.args as Record<string, unknown> | undefined,
        result: c.result,
      };
    }) as ThreadMessageLike['content'],
    createdAt: msg.createdAt,
  };
}

function convertFromAppendMessage(msg: AppendMessage): MessageContent[] {
  const content: MessageContent[] = [];

  for (const part of msg.content) {
    if (part.type === 'text') {
      content.push({ type: 'text', text: part.text });
    }
  }

  return content;
}

// ============================================================================
// Runtime Provider
// ============================================================================

interface LaunchlineRuntimeProviderProps {
  children: ReactNode;
  threadId?: string;
  context?: Record<string, unknown>;
  onThreadCreated?: (threadId: string) => void;
}

export function LaunchlineRuntimeProvider({
  children,
  threadId: initialThreadId,
  context,
  onThreadCreated,
}: LaunchlineRuntimeProviderProps) {
  const [internalMessages, setInternalMessages] = useState<InternalMessage[]>(
    [],
  );
  const [isRunning, setIsRunning] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(
    initialThreadId || null,
  );
  const currentAssistantIdRef = useRef<string | null>(null);

  // Convert internal messages to ThreadMessageLike for the runtime
  const messages = useMemo(
    () => internalMessages.map(convertToThreadMessageLike),
    [internalMessages],
  );

  // Load messages when thread changes
  const loadMessages = useCallback(async (threadId: string) => {
    try {
      const { messages: threadMessages } = await getMessages(threadId);
      setInternalMessages(threadMessages.map(convertToInternalMessage));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, []);

  // Initialize thread if needed
  const ensureThread = useCallback(async (): Promise<string> => {
    if (currentThreadId) return currentThreadId;

    const thread = await createThread();
    setCurrentThreadId(thread.id);
    onThreadCreated?.(thread.id);
    return thread.id;
  }, [currentThreadId, onThreadCreated]);

  // Handle new message
  const onNew = useCallback(
    async (message: AppendMessage) => {
      const threadId = await ensureThread();
      const content = convertFromAppendMessage(message);

      // Generate IDs
      const userMsgId = `temp-user-${Date.now()}`;
      const assistantMsgId = `temp-assistant-${Date.now()}`;
      currentAssistantIdRef.current = assistantMsgId;

      // Optimistically add user message
      const userMsg: InternalMessage = {
        id: userMsgId,
        role: 'user',
        content: content.map((c) => ({
          type: c.type as 'text',
          text: (c as TextContent).text,
        })),
        createdAt: new Date(),
      };

      // Optimistic assistant message
      const assistantMsg: InternalMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: [{ type: 'text', text: '' }],
        createdAt: new Date(),
      };

      setInternalMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsRunning(true);

      try {
        await streamMessage(threadId, content, context, {
          onUserMessage: (id) => {
            setInternalMessages((prev) =>
              prev.map((m) => (m.id === userMsgId ? { ...m, id } : m)),
            );
          },
          onAssistantStart: (id) => {
            currentAssistantIdRef.current = id;
            setInternalMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, id } : m)),
            );
          },
          onTextDelta: ({ id, text }) => {
            setInternalMessages((prev) =>
              prev.map((m) => {
                if (
                  m.id === id ||
                  m.id === assistantMsgId ||
                  m.id === currentAssistantIdRef.current
                ) {
                  // Update existing text content or add it
                  const newContent = [...m.content];
                  const textIndex = newContent.findIndex(
                    (c) => c.type === 'text',
                  );
                  if (textIndex >= 0) {
                    newContent[textIndex] = { ...newContent[textIndex], text };
                  } else {
                    newContent.unshift({ type: 'text', text });
                  }
                  return { ...m, id, content: newContent };
                }
                return m;
              }),
            );
          },
          onToolCall: ({ toolCallId, toolName, args }) => {
            setInternalMessages((prev) =>
              prev.map((m) => {
                if (m.id === currentAssistantIdRef.current) {
                  const hasToolCall = m.content.some(
                    (c) =>
                      c.type === 'tool-call' && c.toolCallId === toolCallId,
                  );
                  if (!hasToolCall) {
                    return {
                      ...m,
                      content: [
                        ...m.content,
                        { type: 'tool-call', toolCallId, toolName, args },
                      ],
                    };
                  }
                }
                return m;
              }),
            );
          },
          onToolResult: ({ toolCallId, result }) => {
            setInternalMessages((prev) =>
              prev.map((m) => {
                if (m.role === 'assistant') {
                  return {
                    ...m,
                    content: m.content.map((c) =>
                      c.type === 'tool-call' && c.toolCallId === toolCallId
                        ? { ...c, result }
                        : c,
                    ),
                  };
                }
                return m;
              }),
            );
          },
          onDone: () => {
            setIsRunning(false);
            currentAssistantIdRef.current = null;
          },
          onError: (error) => {
            console.error('Stream error:', error);
            setIsRunning(false);
            currentAssistantIdRef.current = null;
          },
        });
      } catch (error) {
        console.error('Failed to send message:', error);
        setIsRunning(false);
        currentAssistantIdRef.current = null;
      }
    },
    [ensureThread, context],
  );

  // Handle tool result submission (for human-in-the-loop)
  const onAddToolResult = useCallback(
    async ({
      messageId,
      toolCallId,
      result,
    }: {
      messageId: string;
      toolCallId: string;
      result: unknown;
    }) => {
      if (!currentThreadId) return;

      await addToolResult(currentThreadId, messageId, toolCallId, result);

      setInternalMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: m.content.map((c) =>
                  c.type === 'tool-call' && c.toolCallId === toolCallId
                    ? { ...c, result }
                    : c,
                ),
              }
            : m,
        ),
      );
    },
    [currentThreadId],
  );

  // Handle reload/regenerate
  const onReload = useCallback(
    async (parentId: string | null) => {
      if (!currentThreadId) return;

      const parentIndex = parentId
        ? internalMessages.findIndex((m) => m.id === parentId)
        : -1;

      const previousMessages =
        parentIndex >= 0 ? internalMessages.slice(0, parentIndex + 1) : [];

      setInternalMessages(previousMessages);
    },
    [currentThreadId, internalMessages],
  );

  // Handle cancel
  const onCancel = useCallback(async () => {
    setIsRunning(false);
    currentAssistantIdRef.current = null;
  }, []);

  // Set messages handler for runtime
  const setMessagesHandler = useCallback(
    (newMessages: readonly ThreadMessageLike[]) => {
      // Convert back to internal format
      setInternalMessages(
        newMessages.map((m) => ({
          id: m.id || `msg-${Date.now()}`,
          role: m.role as 'user' | 'assistant' | 'system',
          content:
            typeof m.content === 'string'
              ? [{ type: 'text' as const, text: m.content }]
              : (m.content as any[]).map((c: any) => {
                  if (c.type === 'text') {
                    return { type: 'text' as const, text: c.text };
                  }
                  return {
                    type: 'tool-call' as const,
                    toolCallId: c.toolCallId,
                    toolName: c.toolName,
                    args: c.args,
                    result: c.result,
                  };
                }),
          createdAt: m.createdAt || new Date(),
        })),
      );
    },
    [],
  );

  const runtime = useExternalStoreRuntime({
    messages,
    setMessages: setMessagesHandler,
    isRunning,
    onNew,
    onReload,
    onCancel,
    onAddToolResult,
    convertMessage: (msg) => msg, // Already in correct format
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

// ============================================================================
// Hook for external thread management
// ============================================================================

export function useLaunchlineThread() {
  const [threadId, setThreadId] = useState<string | null>(null);

  const initThread = useCallback(async () => {
    const thread = await createThread();
    setThreadId(thread.id);
    return thread;
  }, []);

  const loadThread = useCallback(async (id: string) => {
    setThreadId(id);
    return getMessages(id);
  }, []);

  return {
    threadId,
    setThreadId,
    initThread,
    loadThread,
  };
}
