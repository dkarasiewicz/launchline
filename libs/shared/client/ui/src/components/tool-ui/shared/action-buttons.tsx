'use client';

/**
 * Action Buttons Component
 *
 * Reusable action buttons for tool UI footers.
 */

import { Button } from '../../ui/button';
import type { Action, ActionsConfig } from './schema';

export interface ActionButtonsProps {
  actions?: Action[] | ActionsConfig;
  onAction?: (actionId: string) => void;
  onBeforeAction?: (actionId: string) => boolean;
  disabled?: boolean;
  className?: string;
}

export function ActionButtons({
  actions,
  onAction,
  onBeforeAction,
  disabled = false,
  className,
}: ActionButtonsProps) {
  if (!actions) return null;

  const actionList = Array.isArray(actions) ? actions : actions.actions;
  const position = Array.isArray(actions) ? 'end' : actions.position || 'end';

  const handleClick = (actionId: string) => {
    if (onBeforeAction && !onBeforeAction(actionId)) {
      return;
    }
    onAction?.(actionId);
  };

  const justifyClass = {
    start: 'justify-start',
    end: 'justify-end',
    between: 'justify-between',
  }[position];

  return (
    <div className={`flex gap-2 ${justifyClass} ${className || ''}`}>
      {actionList.map((action) => (
        <Button
          key={action.id}
          variant={action.variant || 'default'}
          size="sm"
          disabled={disabled || action.disabled}
          onClick={() => handleClick(action.id)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
