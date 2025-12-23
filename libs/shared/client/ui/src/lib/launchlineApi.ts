/**
 * Launchline Chat API Client
 * 
 * Connects to the NestJS backend with SSE streaming support.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// ============================================================================
// Types
// ============================================================================

export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: MessageContent[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export type MessageContent = 
  | TextContent
  | ToolCallContent
  | ToolResultContent;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolCallContent {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface ToolResultContent {
  type: 'tool-result';
  toolCallId: string;
  result: unknown;
}

export interface Thread {
  id: string;
  workspaceId: string;
  title?: string;
  status: 'regular' | 'archived';
  createdAt: string;
  updatedAt: string;
}

// SSE Event types
export interface SSETextDeltaEvent {
  id: string;
  text: string;
  delta: string;
}

export interface SSEToolCallEvent {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface SSEToolResultEvent {
  toolCallId: string;
  result: unknown;
}

// ============================================================================
// API Client
// ============================================================================

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Workspace-Id': 'ws_dev', // TODO: Get from auth context
    'X-User-Id': 'user_dev', // TODO: Get from auth context
  };
}

// Thread Management
export async function createThread(title?: string): Promise<Thread> {
  const res = await fetch(`${API_BASE}/threads`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title }),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to create thread: ${res.statusText}`);
  }
  
  return res.json();
}

export async function getThread(threadId: string): Promise<Thread> {
  const res = await fetch(`${API_BASE}/threads/${threadId}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to get thread: ${res.statusText}`);
  }
  
  return res.json();
}

export async function listThreads(): Promise<{ threads: Thread[]; archivedThreads: Thread[] }> {
  const res = await fetch(`${API_BASE}/threads`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to list threads: ${res.statusText}`);
  }
  
  return res.json();
}

export async function updateThread(threadId: string, data: { title?: string }): Promise<Thread> {
  const res = await fetch(`${API_BASE}/threads/${threadId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to update thread: ${res.statusText}`);
  }
  
  return res.json();
}

export async function deleteThread(threadId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/threads/${threadId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to delete thread: ${res.statusText}`);
  }
}

export async function archiveThread(threadId: string): Promise<Thread> {
  const res = await fetch(`${API_BASE}/threads/${threadId}/archive`, {
    method: 'POST',
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to archive thread: ${res.statusText}`);
  }
  
  return res.json();
}

export async function unarchiveThread(threadId: string): Promise<Thread> {
  const res = await fetch(`${API_BASE}/threads/${threadId}/unarchive`, {
    method: 'POST',
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to unarchive thread: ${res.statusText}`);
  }
  
  return res.json();
}

// Messages
export async function getMessages(threadId: string): Promise<{ messages: ThreadMessage[] }> {
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to get messages: ${res.statusText}`);
  }
  
  return res.json();
}

// ============================================================================
// SSE Streaming
// ============================================================================

export interface StreamCallbacks {
  onUserMessage?: (id: string) => void;
  onAssistantStart?: (id: string) => void;
  onTextDelta?: (data: SSETextDeltaEvent) => void;
  onToolCall?: (data: SSEToolCallEvent) => void;
  onToolResult?: (data: SSEToolResultEvent) => void;
  onDone?: (id: string) => void;
  onError?: (error: { message: string }) => void;
}

export async function streamMessage(
  threadId: string,
  content: MessageContent[],
  context?: Record<string, unknown>,
  callbacks?: StreamCallbacks,
  abortSignal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/${threadId}/messages`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ content, context }),
    signal: abortSignal,
  });

  if (!res.ok) {
    throw new Error(`Failed to send message: ${res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7);
        } else if (line.startsWith('data: ') && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (currentEvent) {
              case 'user-message':
                callbacks?.onUserMessage?.(data.id);
                break;
              case 'assistant-start':
                callbacks?.onAssistantStart?.(data.id);
                break;
              case 'text-delta':
                callbacks?.onTextDelta?.(data);
                break;
              case 'tool-call':
                callbacks?.onToolCall?.(data);
                break;
              case 'tool-result':
                callbacks?.onToolResult?.(data);
                break;
              case 'done':
                callbacks?.onDone?.(data.id);
                break;
              case 'error':
                callbacks?.onError?.(data);
                break;
            }
          } catch (e) {
            console.warn('Failed to parse SSE data:', e);
          }
          currentEvent = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Tool Results (for human-in-the-loop)
export async function addToolResult(
  threadId: string,
  messageId: string,
  toolCallId: string,
  result: unknown,
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/${threadId}/messages/${messageId}/tool-result`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ toolCallId, result }),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to add tool result: ${res.statusText}`);
  }
}
