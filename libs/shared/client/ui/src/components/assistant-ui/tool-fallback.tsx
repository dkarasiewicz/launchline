'use client';

/**
 * Tool Fallback Component
 *
 * Default UI for tools that don't have a custom Tool UI defined.
 */

import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XCircleIcon,
  Loader2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const isCancelled =
    status?.type === 'incomplete' && status.reason === 'cancelled';
  const isRunning = status?.type === 'running';
  const isError = status?.type === 'incomplete' && status.reason === 'error';

  const cancelledReason =
    isCancelled && status.error
      ? typeof status.error === 'string'
        ? status.error
        : JSON.stringify(status.error)
      : null;

  // Get friendly tool name
  const friendlyToolName = toolName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      className={cn(
        'mb-4 flex w-full flex-col gap-3 rounded-lg border py-3',
        isCancelled && 'border-muted-foreground/30 bg-muted/30',
        isError && 'border-red-200 bg-red-50/50',
      )}
    >
      <div className="flex items-center gap-2 px-4">
        {isRunning ? (
          <Loader2Icon className="h-4 w-4 animate-spin text-blue-500" />
        ) : isCancelled || isError ? (
          <XCircleIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <CheckIcon className="h-4 w-4 text-green-500" />
        )}
        <p
          className={cn(
            'grow',
            isCancelled && 'text-muted-foreground line-through',
          )}
        >
          {isRunning
            ? 'Running: '
            : isCancelled
              ? 'Cancelled: '
              : 'Used tool: '}
          <b>{friendlyToolName}</b>
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronUpIcon className="h-4 w-4" />
          )}
        </Button>
      </div>

      {!isCollapsed && (
        <div className="flex flex-col gap-2 border-t pt-2">
          {cancelledReason && (
            <div className="px-4">
              <p className="font-semibold text-muted-foreground text-sm">
                Cancelled reason:
              </p>
              <p className="text-muted-foreground text-sm">{cancelledReason}</p>
            </div>
          )}
          <div className={cn('px-4', isCancelled && 'opacity-60')}>
            <p className="font-semibold text-muted-foreground text-sm mb-1">
              Arguments:
            </p>
            <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-sm">
              {argsText}
            </pre>
          </div>
          {!isCancelled && result !== undefined && (
            <div className="border-t border-dashed px-4 pt-2">
              <p className="font-semibold text-sm mb-1">Result:</p>
              <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-sm max-h-64 overflow-auto">
                {typeof result === 'string'
                  ? result
                  : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
