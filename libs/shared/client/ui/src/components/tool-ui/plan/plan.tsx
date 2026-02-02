'use client';

/**
 * Plan Component
 *
 * Displays a multi-step plan with progress visualization.
 * Supports expandable details, status indicators, and action buttons.
 */

import { useState, useMemo } from 'react';
import {
  Circle,
  CircleDashed,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  PartyPopper,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardFooter,
} from '../../ui/card';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import { cn } from '../../../lib/utils';
import { ActionButtons } from '../shared/action-buttons';
import type {
  Plan as PlanType,
  PlanTodo,
  PlanTodoStatus,
  Action,
  ActionsConfig,
} from '../shared/schema';

// Need to import React for class component
import React from 'react';

// ============================================================================
// STATUS ICONS & STYLES
// ============================================================================

const statusConfig: Record<
  PlanTodoStatus,
  {
    icon: typeof Circle;
    iconClass: string;
    labelClass: string;
    animate?: boolean;
  }
> = {
  pending: {
    icon: Circle,
    iconClass: 'text-muted-foreground',
    labelClass: 'text-muted-foreground',
  },
  in_progress: {
    icon: CircleDashed,
    iconClass: 'text-blue-500',
    labelClass: 'text-foreground animate-shimmer',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    labelClass: 'text-muted-foreground line-through',
  },
  cancelled: {
    icon: XCircle,
    iconClass: 'text-destructive',
    labelClass: 'text-muted-foreground line-through',
  },
};

// ============================================================================
// TODO ITEM COMPONENT
// ============================================================================

interface TodoItemProps {
  todo: PlanTodo;
  isExpanded: boolean;
  onToggle: () => void;
  hasDescription: boolean;
}

function TodoItem({
  todo,
  isExpanded,
  onToggle,
  hasDescription,
}: TodoItemProps) {
  const config = statusConfig[todo.status];
  const Icon = config.icon;

  return (
    <div className="py-2">
      <div
        className={cn(
          'flex items-start gap-3',
          hasDescription && 'cursor-pointer',
        )}
        onClick={hasDescription ? onToggle : undefined}
      >
        <div className="mt-0.5 flex-shrink-0">
          <Icon
            className={cn(
              'h-5 w-5',
              config.iconClass,
              config.animate && 'animate-spin',
            )}
            style={config.animate ? { animationDuration: '3s' } : undefined}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-sm font-medium', config.labelClass)}>
              {todo.label}
            </span>
            {hasDescription && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          {hasDescription && isExpanded && (
            <p className="mt-1 text-sm text-muted-foreground">
              {todo.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PLAN COMPONENT
// ============================================================================

export interface PlanProps extends PlanType {
  /** Maximum visible todos before "show more" */
  maxVisibleTodos?: number;
  /** Show progress bar and summary */
  showProgress?: boolean;
  /** Action buttons for footer */
  responseActions?: Action[] | ActionsConfig;
  /** Callback when action clicked */
  onResponseAction?: (actionId: string) => void;
  /** Validation before action */
  onBeforeResponseAction?: (actionId: string) => boolean;
  /** Additional CSS classes */
  className?: string;
}

export function Plan({
  id,
  title,
  description,
  todos,
  maxVisibleTodos = 4,
  showProgress = true,
  responseActions,
  onResponseAction,
  onBeforeResponseAction,
  className,
}: PlanProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAllTodos, setShowAllTodos] = useState(false);

  // Calculate progress
  const progress = useMemo(() => {
    const completed = todos.filter(
      (t) => t.status === 'completed' || t.status === 'cancelled',
    ).length;
    const inProgress = todos.filter((t) => t.status === 'in_progress').length;
    return {
      completed,
      inProgress,
      total: todos.length,
      percentage: Math.round((completed / todos.length) * 100),
      isAllComplete: completed === todos.length,
    };
  }, [todos]);

  // Visible todos
  const visibleTodos = showAllTodos ? todos : todos.slice(0, maxVisibleTodos);
  const hiddenCount = todos.length - maxVisibleTodos;

  const toggleExpanded = (todoId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(todoId)) {
        next.delete(todoId);
      } else {
        next.add(todoId);
      }
      return next;
    });
  };

  return (
    <Card className={cn('w-full max-w-xl overflow-hidden', className)}>
      <CardContent className="pt-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold flex items-center gap-2 text-foreground">
              {progress.isAllComplete && (
                <PartyPopper className="h-5 w-5 text-amber-500" />
              )}
              {title}
            </div>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {showProgress && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {progress.completed} of {progress.total} complete
              </span>
              <span className="font-medium">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>
        )}

        <div className="divide-y divide-border">
          {visibleTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              isExpanded={expandedIds.has(todo.id)}
              onToggle={() => toggleExpanded(todo.id)}
              hasDescription={!!todo.description}
            />
          ))}
        </div>

        {/* Show more / less button */}
        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-muted-foreground"
            onClick={() => setShowAllTodos(!showAllTodos)}
          >
            {showAllTodos ? (
              <>
                <ChevronUp className="mr-1 h-4 w-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-4 w-4" />
                Show {hiddenCount} more
              </>
            )}
          </Button>
        )}

        {/* Celebration message */}
        {progress.isAllComplete && (
          <div className="mt-4 rounded-lg bg-status-success-muted p-3 text-center">
            <p className="text-sm font-medium text-status-success">
              🎉 All tasks completed!
            </p>
          </div>
        )}
      </CardContent>

      {/* Action buttons */}
      {responseActions && (
        <CardFooter className="border-t bg-muted/30 pt-4">
          <ActionButtons
            actions={responseActions}
            onAction={onResponseAction}
            onBeforeAction={onBeforeResponseAction}
            className="w-full"
          />
        </CardFooter>
      )}
    </Card>
  );
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface PlanErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface PlanErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class PlanErrorBoundary extends React.Component<
  PlanErrorBoundaryProps,
  PlanErrorBoundaryState
> {
  constructor(props: PlanErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): PlanErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <Card className="w-full max-w-xl border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                Failed to render plan: {this.state.error?.message}
              </p>
            </CardContent>
          </Card>
        )
      );
    }

    return this.props.children;
  }
}
