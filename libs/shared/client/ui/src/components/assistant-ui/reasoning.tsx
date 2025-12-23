'use client';

/**
 * Reasoning Component
 *
 * Displays AI reasoning/thinking messages in a collapsible UI.
 * Shows a shimmer effect while streaming and groups consecutive reasoning parts.
 *
 * Based on assistant-ui's Reasoning component pattern.
 */

import { FC, PropsWithChildren, useState, useRef, useEffect } from 'react';
import { ChevronRight, Brain } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { cn } from '../../lib/utils';

// ============================================================================
// REASONING ROOT
// ============================================================================

interface ReasoningRootProps extends PropsWithChildren {
  className?: string;
  defaultOpen?: boolean;
}

const ReasoningRoot: FC<ReasoningRootProps> = ({
  children,
  className,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        'aui-reasoning-root mb-3 w-full rounded-lg border bg-muted/30',
        className,
      )}
    >
      {children}
    </Collapsible>
  );
};

// ============================================================================
// REASONING TRIGGER
// ============================================================================

interface ReasoningTriggerProps {
  active?: boolean;
  className?: string;
  label?: string;
}

const ReasoningTrigger: FC<ReasoningTriggerProps> = ({
  active = false,
  className,
  label = 'Thinking',
}) => {
  return (
    <CollapsibleTrigger
      className={cn(
        'aui-reasoning-trigger group/trigger flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/trigger:rotate-90" />
      <Brain
        className={cn(
          'h-4 w-4 shrink-0',
          active && 'animate-pulse text-primary',
        )}
      />
      <span
        className={cn('flex-1 text-left', active && 'aui-reasoning-shimmer')}
      >
        {label}
        {active && '...'}
      </span>
      {active && (
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
        </span>
      )}
    </CollapsibleTrigger>
  );
};

// ============================================================================
// REASONING CONTENT
// ============================================================================

interface ReasoningContentProps extends PropsWithChildren {
  className?: string;
}

const ReasoningContent: FC<ReasoningContentProps> = ({
  children,
  className,
}) => {
  return (
    <CollapsibleContent
      className={cn(
        'aui-reasoning-content overflow-hidden border-t bg-background/50',
        className,
      )}
    >
      <div className="px-3 py-2 text-sm text-muted-foreground">{children}</div>
    </CollapsibleContent>
  );
};

// ============================================================================
// REASONING TEXT
// ============================================================================

interface ReasoningTextProps extends PropsWithChildren {
  className?: string;
}

const ReasoningText: FC<ReasoningTextProps> = ({ children, className }) => {
  return (
    <div className={cn('aui-reasoning-text whitespace-pre-wrap', className)}>
      {children}
    </div>
  );
};

// ============================================================================
// REASONING COMPONENT (for MessagePrimitive.Parts)
// ============================================================================

/**
 * Reasoning component for use with MessagePrimitive.Parts
 * Renders the reasoning text content with markdown support
 */
export const Reasoning: FC = () => {
  // This component is meant to be used within MessagePrimitive.Parts
  // The actual content will be provided by the context
  return null;
};

// ============================================================================
// REASONING GROUP COMPONENT
// ============================================================================

export interface ReasoningGroupProps extends PropsWithChildren {
  /** Whether reasoning is currently streaming */
  isStreaming?: boolean;
  /** Custom label for the reasoning section */
  label?: string;
  /** Whether to start expanded */
  defaultOpen?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ReasoningGroup wraps consecutive reasoning parts in a collapsible container
 * Use with MessagePrimitive.Parts components={{ ReasoningGroup }}
 */
export const ReasoningGroup: FC<ReasoningGroupProps> = ({
  children,
  isStreaming = false,
  label = 'Thinking',
  defaultOpen = false,
  className,
}) => {
  return (
    <ReasoningRoot
      defaultOpen={defaultOpen || isStreaming}
      className={className}
    >
      <ReasoningTrigger active={isStreaming} label={label} />
      <ReasoningContent aria-busy={isStreaming}>
        <ReasoningText>{children}</ReasoningText>
      </ReasoningContent>
    </ReasoningRoot>
  );
};

// ============================================================================
// THINKING INDICATOR (standalone usage)
// ============================================================================

export interface ThinkingIndicatorProps {
  /** Whether the agent is currently thinking */
  isThinking?: boolean;
  /** Custom message to display */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Standalone thinking indicator for when the agent is processing
 * Use this when you want to show a thinking state without reasoning content
 */
export const ThinkingIndicator: FC<ThinkingIndicatorProps> = ({
  isThinking = true,
  message = 'Thinking',
  className,
}) => {
  if (!isThinking) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground',
        className,
      )}
    >
      <Brain className="h-4 w-4 animate-pulse text-primary" />
      <span className="aui-reasoning-shimmer">{message}...</span>
      <span className="flex gap-1 ml-auto">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
      </span>
    </div>
  );
};

// Export internal components for custom implementations
export { ReasoningRoot, ReasoningTrigger, ReasoningContent, ReasoningText };
