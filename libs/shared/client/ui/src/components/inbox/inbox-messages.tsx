'use client';

import {
  MessagePrimitive,
  ActionBarPrimitive,
  AssistantIf,
} from '@assistant-ui/react';
import { Button } from '../ui/button';
import {
  User,
  RefreshCwIcon,
  CopyIcon,
  CheckIcon,
  Loader2,
} from 'lucide-react';
import { LogoIcon } from '../logo';

/**
 * InboxUserMessage - User message component following assistant-ui patterns
 */
export function InboxUserMessage() {
  return (
    <MessagePrimitive.Root
      className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto w-full animate-in py-3 duration-150"
      data-role="user"
    >
      <div className="flex justify-end gap-2">
        <div className="aui-user-message-content wrap-break-word max-w-[75%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 shadow-sm">
          <MessagePrimitive.Unstable_PartsGroupedByParentId components={{}} />
        </div>
        <div className="aui-user-message-avatar flex items-start justify-end">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

/**
 * InboxAssistantMessage - Assistant message component following assistant-ui patterns
 */
export function InboxAssistantMessage() {
  return (
    <AssistantIf
      condition={({ message }) =>
        message.parts.length > 0 || message.status?.type !== 'running'
      }
    >
      <MessagePrimitive.Root
        className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full animate-in py-3 duration-150"
        data-role="assistant"
      >
        <div className="flex gap-3 group">
          <div className="aui-assistant-message-avatar w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <LogoIcon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="aui-assistant-message-content wrap-break-word rounded-2xl rounded-tl-sm bg-card border border-border/50 px-4 py-2.5 shadow-sm text-foreground leading-relaxed">
              <MessagePrimitive.Unstable_PartsGroupedByParentId components={{}} />
            </div>
            <div className="aui-assistant-message-footer mt-1 flex">
              <InboxAssistantActionBar />
            </div>
          </div>
        </div>
      </MessagePrimitive.Root>
    </AssistantIf>
  );
}

export function InboxAssistantThinking({
  label = 'Linea is thinking...',
}: {
  label?: string;
}) {
  return (
    <AssistantIf
      condition={({ thread }) => {
        const messages = thread.messages;
        const last = messages.length > 0 ? messages[messages.length - 1] : null;
        const lastRole = last?.role;
        const lastStatus =
          lastRole === 'assistant' ? last?.status?.type : undefined;
        const lastParts = last?.parts ?? [];
        const lastHasContent = lastParts.length > 0;
        return (
          thread.isRunning &&
          (lastRole !== 'assistant' ||
            (lastStatus === 'running' && !lastHasContent))
        );
      }}
    >
      <div className="fade-in slide-in-from-bottom-1 relative mx-auto w-full animate-in py-3 duration-150">
        <div className="flex gap-3 group">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <LogoIcon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="rounded-2xl rounded-tl-sm bg-card border border-border/50 px-4 py-2.5 shadow-sm text-foreground/80 leading-relaxed flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          </div>
        </div>
      </div>
    </AssistantIf>
  );
}

/**
 * InboxAssistantActionBar - Action bar for assistant messages
 */
function InboxAssistantActionBar() {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-1 hover:bg-accent hover:text-accent-foreground"
        >
          <AssistantIf condition={({ message }) => message.isCopied}>
            <CheckIcon className="h-3 w-3" />
          </AssistantIf>
          <AssistantIf condition={({ message }) => !message.isCopied}>
            <CopyIcon className="h-3 w-3" />
          </AssistantIf>
        </Button>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-1 hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCwIcon className="h-3 w-3" />
        </Button>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
}
