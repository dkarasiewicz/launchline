'use client';

/**
 * Linea Thread Component
 *
 * A complete chat interface for the Linea DeepAgent using
 * assistant-ui primitives.
 */

import { MarkdownText } from './markdown-text';
import { ToolFallback } from './tool-fallback';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import {
  ActionBarPrimitive,
  AssistantIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
  BotIcon,
} from 'lucide-react';
import type { FC } from 'react';

// ============================================================================
// Main Thread Component
// ============================================================================

interface LineaThreadProps {
  className?: string;
}

export const LineaThread: FC<LineaThreadProps> = ({ className }) => {
  return (
    <ThreadPrimitive.Root
      className={cn(
        'aui-root aui-thread-root @container flex h-full flex-col bg-background',
        className,
      )}
      style={{
        ['--thread-max-width' as string]: '48rem',
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth px-4 pt-4"
      >
        <AssistantIf condition={({ thread }) => thread.isEmpty}>
          <ThreadWelcome />
        </AssistantIf>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            EditComposer,
            AssistantMessage,
          }}
        />

        <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
          <ThreadScrollToBottom />
          <Composer />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

// ============================================================================
// Thread Welcome
// ============================================================================

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-(--thread-max-width) grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <BotIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="fade-in slide-in-from-bottom-1 animate-in font-semibold text-2xl duration-200">
                Hello, I&apos;m Linea
              </h1>
              <p className="text-muted-foreground">Your AI PM Assistant</p>
            </div>
          </div>
          <p className="fade-in slide-in-from-bottom-1 animate-in text-muted-foreground text-lg delay-75 duration-200">
            I can help you manage blockers, update tickets, and keep your
            projects on track.
          </p>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  );
};

// ============================================================================
// Thread Suggestions
// ============================================================================

const SUGGESTIONS = [
  {
    title: 'Show my blockers',
    label: "What's blocking progress?",
    prompt: 'Show me the current blockers in my inbox',
  },
  {
    title: 'Project status',
    label: 'Get a quick update',
    prompt: 'Generate a project status update for this week',
  },
  {
    title: 'Review stalled PRs',
    label: 'What needs attention?',
    prompt: 'Are there any stalled PRs that need review?',
  },
  {
    title: 'Check priorities',
    label: 'Has anything shifted?',
    prompt: 'Show me any tickets with priority drift',
  },
] as const;

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4">
      {SUGGESTIONS.map((suggestion, index) => (
        <div
          key={suggestion.prompt}
          className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 @md:nth-[n+5]:block nth-[n+5]:hidden animate-in fill-mode-both duration-200"
          style={{ animationDelay: `${100 + index * 50}ms` }}
        >
          <ThreadPrimitive.Suggestion prompt={suggestion.prompt} send asChild>
            <Button
              variant="ghost"
              className="aui-thread-welcome-suggestion h-auto w-full @md:flex-col flex-wrap items-start justify-start gap-1 rounded-2xl border px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
              aria-label={suggestion.prompt}
            >
              <span className="aui-thread-welcome-suggestion-text-1 font-medium">
                {suggestion.title}
              </span>
              <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
                {suggestion.label}
              </span>
            </Button>
          </ThreadPrimitive.Suggestion>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Scroll to Bottom Button
// ============================================================================

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <Button
        variant="outline"
        size="icon"
        className="aui-thread-scroll-to-bottom -top-12 absolute z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon className="h-4 w-4" />
        <span className="sr-only">Scroll to bottom</span>
      </Button>
    </ThreadPrimitive.ScrollToBottom>
  );
};

// ============================================================================
// Composer
// ============================================================================

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <div className="flex w-full flex-col rounded-2xl border border-input bg-background px-1 pt-2 outline-none transition-shadow has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring/20">
        <ComposerPrimitive.Input
          placeholder="Ask Linea about your projects..."
          className="aui-composer-input mb-1 max-h-32 min-h-14 w-full resize-none bg-transparent px-4 pt-2 pb-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerAction />
      </div>
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC = () => {
  return (
    <div className="aui-composer-action-wrapper relative mx-2 mb-2 flex items-center justify-end">
      <AssistantIf condition={({ thread }) => !thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <Button
            type="submit"
            size="icon"
            className="aui-composer-send size-8 rounded-full"
            aria-label="Send message"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-4" />
          </Button>
        </ComposerPrimitive.Send>
      </AssistantIf>

      <AssistantIf condition={({ thread }) => thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-8 rounded-full"
            aria-label="Stop generating"
          >
            <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AssistantIf>
    </div>
  );
};

// ============================================================================
// Assistant Message
// ============================================================================

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-3 duration-150"
      data-role="assistant"
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <BotIcon className="h-4 w-4 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="aui-assistant-message-content wrap-break-word text-foreground leading-relaxed">
            <MessagePrimitive.Parts
              components={{
                Text: MarkdownText,
                tools: { Fallback: ToolFallback },
              }}
            />
          </div>

          <div className="aui-assistant-message-footer mt-2 flex">
            <BranchPicker />
            <AssistantActionBar />
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root -ml-1 flex gap-1 text-muted-foreground"
    >
      <ActionBarPrimitive.Copy asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <AssistantIf condition={({ message }) => message.isCopied}>
            <CheckIcon className="h-3 w-3" />
          </AssistantIf>
          <AssistantIf condition={({ message }) => !message.isCopied}>
            <CopyIcon className="h-3 w-3" />
          </AssistantIf>
          <span className="sr-only">Copy</span>
        </Button>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <RefreshCwIcon className="h-3 w-3" />
          <span className="sr-only">Regenerate</span>
        </Button>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

// ============================================================================
// User Message
// ============================================================================

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-(--thread-max-width) animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3 duration-150 [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content wrap-break-word rounded-2xl bg-muted px-4 py-2.5 text-foreground">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper -translate-x-full -translate-y-1/2 absolute top-1/2 left-0 pr-2">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker className="aui-user-branch-picker -mr-1 col-span-full col-start-1 row-start-3 justify-end" />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <PencilIcon className="h-3 w-3" />
          <span className="sr-only">Edit</span>
        </Button>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

// ============================================================================
// Edit Composer
// ============================================================================

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col px-2 py-3">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">Update</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

// ============================================================================
// Branch Picker
// ============================================================================

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        'aui-branch-picker-root -ml-2 mr-2 inline-flex items-center text-muted-foreground text-xs',
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5">
          <ChevronLeftIcon className="h-3 w-3" />
          <span className="sr-only">Previous branch</span>
        </Button>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5">
          <ChevronRightIcon className="h-3 w-3" />
          <span className="sr-only">Next branch</span>
        </Button>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};

// Export all components
export {
  ThreadWelcome,
  ThreadSuggestions,
  ThreadScrollToBottom,
  Composer,
  AssistantMessage,
  UserMessage,
  EditComposer,
  BranchPicker,
};
