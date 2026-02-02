import { HumanMessage, RemoveMessage } from '@langchain/langgraph-sdk';
import { SerializedConstructor } from '@langchain/core/load/serializable';
import {
  LangChainMessage,
  LangChainToolCall,
} from '@assistant-ui/react-langgraph';
import { ReadonlyJSONObject } from 'assistant-stream/utils';

type MessageType =
  | 'human'
  | 'user'
  | 'ai'
  | 'assistant'
  | 'system'
  | 'developer'
  | 'function'
  | 'tool'
  | 'remove'
  | 'unknown';

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  type: 'tool_call';
}

interface OpenAIFunctionToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

type RawToolCall = ToolCall | OpenAIFunctionToolCall | Record<string, unknown>;

function isSerializedConstructor(x: unknown): x is SerializedConstructor {
  return (
    typeof x === 'object' &&
    x != null &&
    'lc' in x &&
    x.lc === 1 &&
    'id' in x &&
    Array.isArray(x.id) &&
    'kwargs' in x &&
    x.kwargs != null &&
    typeof x.kwargs === 'object'
  );
}

function isToolCall(toolCall: unknown): toolCall is ToolCall {
  return (
    typeof toolCall === 'object' &&
    toolCall !== null &&
    'type' in toolCall &&
    toolCall.type === 'tool_call'
  );
}

function isOpenAIFunctionToolCall(
  toolCall: unknown,
): toolCall is OpenAIFunctionToolCall {
  return (
    typeof toolCall === 'object' &&
    toolCall !== null &&
    'id' in toolCall &&
    typeof toolCall.id === 'string' &&
    'type' in toolCall &&
    toolCall.type === 'function' &&
    'function' in toolCall &&
    typeof toolCall.function === 'object' &&
    toolCall.function !== null &&
    'arguments' in toolCall.function &&
    typeof toolCall.function.arguments === 'string' &&
    'name' in toolCall.function &&
    typeof toolCall.function.name === 'string'
  );
}

function coerceToolCall(toolCall: RawToolCall): LangChainToolCall {
  if (isToolCall(toolCall)) {
    return {
      id: toolCall.id,
      name: toolCall.name,
      args: toolCall.args as ReadonlyJSONObject,
      partial_json: (toolCall as unknown as { partial_json?: string })[
        'partial_json'
      ],
    };
  }

  if (isOpenAIFunctionToolCall(toolCall)) {
    return {
      id: toolCall.id,
      args: JSON.parse(toolCall.function.arguments),
      name: toolCall.function.name,
      partial_json: (toolCall.function as unknown as { partial_json?: string })[
        'partial_json'
      ],
    };
  }

  return toolCall as LangChainToolCall;
}

function extractMessageType(params: SerializedConstructor): {
  type: MessageType;
  rest: Record<string, unknown>;
} {
  if (isSerializedConstructor(params)) {
    const className = params.id.at(-1);
    const classNameToType: Record<string, MessageType> = {
      HumanMessage: 'human',
      HumanMessageChunk: 'human',
      AIMessage: 'ai',
      AIMessageChunk: 'ai',
      SystemMessage: 'system',
      SystemMessageChunk: 'system',
      FunctionMessage: 'function',
      FunctionMessageChunk: 'function',
      ToolMessage: 'tool',
      ToolMessageChunk: 'tool',
      RemoveMessage: 'remove',
    };

    return {
      type: (className && classNameToType[className]) || 'unknown',
      rest: params.kwargs as Record<string, unknown>,
    };
  }

  const { type: extractedType, ...otherParams } = params as {
    type?: MessageType;
  };
  return {
    type: extractedType ?? 'unknown',
    rest: otherParams,
  };
}

function createHumanMessage(rest: Record<string, unknown>): HumanMessage {
  return { ...rest, type: 'human' } as HumanMessage;
}

function createAIMessage(rest: Record<string, unknown>): LangChainMessage {
  const {
    tool_calls: rawToolCalls,
    tool_call_chunks: rawToolCallChunks,
    additional_kwargs,
    ...other
  } = rest;
  const nestedToolCalls = (
    additional_kwargs as Record<string, unknown> | undefined
  )?.['tool_calls'];

  let toolCallList = Array.isArray(rawToolCalls)
    ? rawToolCalls
    : Array.isArray(nestedToolCalls)
      ? nestedToolCalls
      : null;

  if (!toolCallList && Array.isArray(rawToolCallChunks)) {
    const aggregated = new Map<
      string,
      { id: string; name: string; args: string }
    >();

    for (const chunk of rawToolCallChunks) {
      if (!chunk || typeof chunk !== 'object') continue;
      const entry = chunk as { id?: string; name?: string; args?: unknown };
      if (!entry.id) continue;

      const existing = aggregated.get(entry.id) ?? {
        id: entry.id,
        name: entry.name ?? 'tool',
        args: '',
      };

      const nextArgs = typeof entry.args === 'string' ? entry.args : '';
      existing.name = entry.name ?? existing.name;
      existing.args = `${existing.args}${nextArgs}`;
      aggregated.set(entry.id, existing);
    }

    if (aggregated.size > 0) {
      toolCallList = Array.from(aggregated.values()).map((call) => ({
        id: call.id,
        name: call.name,
        args: (() => {
          if (!call.args) return {};
          try {
            return JSON.parse(call.args);
          } catch {
            return { raw: call.args };
          }
        })(),
        type: 'tool_call',
      }));
    }
  }

  if (!toolCallList) {
    return { ...rest, type: 'ai' } as LangChainMessage;
  }

  const tool_calls = toolCallList.map(coerceToolCall) as LangChainToolCall[];
  return {
    ...other,
    type: 'ai',
    tool_calls,
    additional_kwargs,
  } as LangChainMessage;
}

function createSystemMessage(rest: Record<string, unknown>): LangChainMessage {
  return { ...rest, type: 'system' } as LangChainMessage;
}

function createDeveloperMessage(
  rest: Record<string, unknown>,
): LangChainMessage {
  const additionalKwargs =
    (rest.additional_kwargs as Record<string, unknown>) ?? {};
  return {
    ...rest,
    type: 'system',
    additional_kwargs: {
      ...additionalKwargs,
      __openai_role__: 'developer',
    },
  } as unknown as LangChainMessage;
}

function createToolMessage(rest: Record<string, unknown>): LangChainMessage {
  return {
    ...rest,
    status: rest.status as 'error' | 'success',
    type: 'tool',
    content: rest.content as string,
    tool_call_id: rest.tool_call_id as string,
    name: rest.name as string,
  };
}

function createRemoveMessage(rest: Record<string, unknown>): RemoveMessage {
  return {
    ...rest,
    type: 'remove',
    id: rest.id as string,
  } as RemoveMessage;
}

export function constructMessageFromParams(
  params: SerializedConstructor,
): LangChainMessage {
  const { type, rest } = extractMessageType(params);

  switch (type) {
    case 'human':
    case 'user':
      return createHumanMessage(rest);

    case 'ai':
    case 'assistant':
      return createAIMessage(rest);

    case 'system':
      return createSystemMessage(rest);

    case 'developer':
      return createDeveloperMessage(rest);

    case 'tool':
      if ('tool_call_id' in rest) {
        return createToolMessage(rest);
      }
      break;

    case 'remove':
      if ('id' in rest && typeof rest.id === 'string') {
        return createRemoveMessage(rest) as unknown as LangChainMessage;
      }
      break;
  }

  throw new Error(
    `Unable to coerce message from array: only human, AI, system, developer, or tool message coercion is currently supported.\n\nReceived: ${JSON.stringify(params, null, 2)}`,
  );
}
