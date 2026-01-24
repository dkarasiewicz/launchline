'use client';

import { useEffect } from 'react';
import {
  ThreadPrimitive,
  AssistantIf,
  useAssistantApi,
} from '@assistant-ui/react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { Sparkles, ArrowDownIcon } from 'lucide-react';

import { InboxComposer } from './inbox-composer';
import { InboxUserMessage, InboxAssistantMessage } from './inbox-messages';

// Tool UIs
import {
  UpdateLinearTicketToolUI,
  SendSlackMessageToolUI,
  InternetSearchToolUI,
} from '../tool-ui/approval/approval';
import { WriteTodosToolUI } from '../tool-ui/plan/_adapter';
import {
  GenerateProjectUpdateTool,
  GetInboxItemsTool,
  SearchMemoriesTool,
} from '../tools/linea/LineaTools';

// Types
export type InboxItemType = 'blocker' | 'drift' | 'update' | 'coverage';
export type LinkedContext = any; // TODO: Import from a shared types file

// Type config
const typeConfig: Record<
  InboxItemType,
  { label: string; color: string; bgColor: string }
> = {
  blocker: {
    label: 'Blocker',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/15',
  },
  drift: {
    label: 'Drift',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
  },
  update: {
    label: 'Update',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/15',
  },
  coverage: {
    label: 'Coverage',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
  },
};

interface InboxThreadProps {
  itemId: string;
  itemContext: {
    title: string;
    summary: string;
    type: InboxItemType;
    priority: string;
    linkedContexts?: LinkedContext[];
  };
}

/**
 * InboxLineaThread - Assistant-UI powered chat for inbox items
 *
 * Uses the selected thread from the runtime (each inbox item is a thread).
 * Follows the official assistant-ui Thread structure:
 * - ThreadPrimitive.Root as the container
 * - ThreadPrimitive.Viewport with turnAnchor="top"
 * - ThreadPrimitive.ViewportFooter for sticky composer
 */
export function InboxLineaThread({ itemId, itemContext }: InboxThreadProps) {
  const api = useAssistantApi();

  // Switch to the thread for this inbox item
  useEffect(() => {
    if (itemId) {
      api.threads().switchToThread(itemId);
    }
  }, [itemId, api]);

  return (
    <div className="flex flex-col h-11/12">
      {/* Thread Messages - scrollable area */}
      <ThreadPrimitive.Root className="aui-thread-root flex-1 flex flex-col min-h-0 bg-background">
        <ThreadPrimitive.Viewport
          turnAnchor="top"
          className="aui-thread-viewport flex-1 flex flex-col overflow-y-auto scroll-smooth px-6 pt-4"
        >
          <AssistantIf condition={({ thread }) => thread.isEmpty}>
            <InboxThreadWelcome context={itemContext} />
          </AssistantIf>

          <AssistantIf condition={({ thread }) => !thread.isEmpty}>
            <div className="grow" />
          </AssistantIf>

          <ThreadPrimitive.Messages
            components={{
              UserMessage: InboxUserMessage,
              AssistantMessage: InboxAssistantMessage,
            }}
          />

          <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto w-full flex flex-col gap-4 overflow-visible pb-4">
            <ThreadScrollToBottom />
            <InboxComposer />
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>

      {/* Register Tool UIs */}
      <SearchMemoriesTool />
      <GetInboxItemsTool />
      <GenerateProjectUpdateTool />
      {/* Human-in-the-loop Approval UIs */}
      <UpdateLinearTicketToolUI />
      <SendSlackMessageToolUI />
      <InternetSearchToolUI />
      {/* DeepAgents built-in write_todos for task planning */}
      <WriteTodosToolUI />
    </div>
  );
}

/**
 * ThreadScrollToBottom - Scroll to bottom button
 */
function ThreadScrollToBottom() {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <Button
        variant="outline"
        size="icon"
        className="aui-thread-scroll-to-bottom self-center rounded-full p-4 shadow-md bg-background border-border/50 disabled:invisible"
      >
        <ArrowDownIcon className="h-4 w-4" />
      </Button>
    </ThreadPrimitive.ScrollToBottom>
  );
}

/**
 * InboxThreadWelcome - Welcome message with inbox context
 */
function InboxThreadWelcome({
  context,
}: {
  context: {
    title: string;
    type: InboxItemType;
    priority: string;
    summary: string;
  };
}) {
  const typeInfo = typeConfig[context.type];

  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex w-full flex-col items-center justify-center px-4 text-center">
          <div
            className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mb-6 fade-in slide-in-from-bottom-1 animate-in duration-300',
              typeInfo.bgColor,
            )}
          >
            <Sparkles className={cn('w-8 h-8', typeInfo.color)} />
          </div>
          <h1 className="aui-thread-welcome-heading fade-in slide-in-from-bottom-1 animate-in font-semibold text-2xl duration-200 mb-2">
            Hi, I&apos;m Linea
          </h1>
          <p className="aui-thread-welcome-subheading fade-in slide-in-from-bottom-1 animate-in text-muted-foreground text-lg delay-75 duration-200 max-w-md mb-6">
            I&apos;m here to help you with this {context.type}. Ask me anything
            or try one of the suggestions below.
          </p>

          {/* Quick action suggestions */}
          <div className="aui-thread-welcome-suggestions grid gap-2 md:grid-cols-3 w-full max-w-2xl">
            <ThreadPrimitive.Suggestion
              prompt="What's blocking this?"
              send
              asChild
            >
              <Button
                variant="outline"
                className="aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200 delay-100 h-auto flex-col items-start justify-start gap-1 rounded-xl px-4 py-3 text-left transition-all hover:bg-accent/50 hover:border-accent-foreground/20 hover:shadow-sm"
              >
                <span className="aui-thread-welcome-suggestion-text-1 font-medium text-sm">
                  What&apos;s the blocker?
                </span>
                <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-xs">
                  Identify blocking issues
                </span>
              </Button>
            </ThreadPrimitive.Suggestion>
            <ThreadPrimitive.Suggestion
              prompt="Who should I assign this to?"
              send
              asChild
            >
              <Button
                variant="outline"
                className="aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200 delay-150 h-auto flex-col items-start justify-start gap-1 rounded-xl px-4 py-3 text-left transition-all hover:bg-accent/50 hover:border-accent-foreground/20 hover:shadow-sm"
              >
                <span className="aui-thread-welcome-suggestion-text-1 font-medium text-sm">
                  Suggest assignee
                </span>
                <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-xs">
                  Find the right person
                </span>
              </Button>
            </ThreadPrimitive.Suggestion>
            <ThreadPrimitive.Suggestion
              prompt="What are the next steps to resolve this?"
              send
              asChild
            >
              <Button
                variant="outline"
                className="aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200 delay-200 h-auto flex-col items-start justify-start gap-1 rounded-xl px-4 py-3 text-left transition-all hover:bg-accent/50 hover:border-accent-foreground/20 hover:shadow-sm"
              >
                <span className="aui-thread-welcome-suggestion-text-1 font-medium text-sm">
                  Next steps
                </span>
                <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-xs">
                  Get action items
                </span>
              </Button>
            </ThreadPrimitive.Suggestion>
          </div>
        </div>
      </div>
    </div>
  );
}
