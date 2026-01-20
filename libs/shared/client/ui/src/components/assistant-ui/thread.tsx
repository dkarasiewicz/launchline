'use client';

/**
 * Thread Component
 *
 * A complete chat thread interface using assistant-ui primitives.
 * Following the assistant-ui shadcn-ui patterns.
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
} from 'lucide-react';
import type { FC } from 'react';

// ============================================================================
// Main Thread Component
// ============================================================================

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root flex h-full flex-col bg-background"
      style={{
        ['--thread-max-width' as string]: '42rem',
      }}
    >
      <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex flex-1 flex-col overflow-y-auto scroll-smooth px-4 pt-8">
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

        <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mt-auto flex w-full max-w-(--thread-max-width) flex-col items-center justify-end rounded-t-lg bg-inherit pb-4 mx-auto z-10">
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
    <div className="flex grow flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <p className="text-muted-foreground">How can I help you today?</p>
      </div>
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
        className="aui-thread-scroll-to-bottom absolute -top-8 rounded-full disabled:invisible"
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
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full items-end rounded-lg border px-2.5 shadow-sm transition-shadow focus-within:shadow-sm">
      <ComposerPrimitive.Input
        placeholder="Write a message..."
        className="aui-composer-input min-h-12 max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-0"
        rows={1}
        autoFocus
      />
      <ComposerAction />
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC = () => {
  return (
    <>
      <AssistantIf condition={({ thread }) => !thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <Button size="icon" className="my-2 size-8 shrink-0 rounded-full">
            <ArrowUpIcon className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </ComposerPrimitive.Send>
      </AssistantIf>

      <AssistantIf condition={({ thread }) => thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button
            variant="default"
            size="icon"
            className="my-2 size-8 shrink-0 rounded-full"
          >
            <SquareIcon className="h-4 w-4 fill-current" />
            <span className="sr-only">Stop</span>
          </Button>
        </ComposerPrimitive.Cancel>
      </AssistantIf>
    </>
  );
};

// ============================================================================
// Assistant Message
// ============================================================================

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="aui-assistant-message-root relative mx-auto mb-6 flex w-full max-w-(--thread-max-width) gap-4">
      <div className="aui-assistant-message-content min-w-0 flex-1">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            tools: { Fallback: ToolFallback },
          }}
        />
      </div>

      <AssistantActionBar />
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root flex flex-col items-center gap-1 pt-1"
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
    <MessagePrimitive.Root className="aui-user-message-root relative mx-auto mb-6 flex w-full max-w-(--thread-max-width) flex-col items-end gap-2">
      <div className="aui-user-message-content relative max-w-[80%] rounded-xl bg-muted px-4 py-2.5">
        <MessagePrimitive.Parts />
      </div>

      <UserActionBar />
      <BranchPicker />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col gap-1"
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
    <MessagePrimitive.Root className="aui-edit-composer-wrapper mx-auto mb-6 flex w-full max-w-(--thread-max-width) flex-col items-end gap-2">
      <ComposerPrimitive.Root className="aui-edit-composer-root w-full max-w-[80%] rounded-xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-12 w-full resize-none bg-transparent p-4 text-sm outline-none"
          autoFocus
        />
        <div className="mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">Send</Button>
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
        'aui-branch-picker-root inline-flex items-center text-xs text-muted-foreground',
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5">
          <ChevronLeftIcon className="h-3 w-3" />
          <span className="sr-only">Previous</span>
        </Button>
      </BranchPickerPrimitive.Previous>
      <span className="font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5">
          <ChevronRightIcon className="h-3 w-3" />
          <span className="sr-only">Next</span>
        </Button>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
