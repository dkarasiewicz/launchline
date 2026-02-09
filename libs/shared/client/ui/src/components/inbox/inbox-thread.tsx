'use client';

import { useEffect } from 'react';
import {
  ThreadPrimitive,
  AssistantIf,
  useAssistantApi,
} from '@assistant-ui/react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { Sparkles, ArrowDownIcon } from 'lucide-react';

import { InboxComposer } from './inbox-composer';
import {
  InboxUserMessage,
  InboxAssistantMessage,
  InboxAssistantThinking,
} from './inbox-messages';

import { LineaToolRegistry } from '../tool-ui';

// Types
export type InboxItemType =
  | 'blocker'
  | 'drift'
  | 'stalled'
  | 'update'
  | 'coverage'
  | 'risk'
  | 'action_required';
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
  stalled: {
    label: 'Stalled',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
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
  risk: {
    label: 'Risk',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
  },
  action_required: {
    label: 'Action Required',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/15',
  },
};

const suggestionConfig: Record<
  InboxItemType,
  Array<{ prompt: string; title: string; subtitle: string }>
> = {
  blocker: [
    {
      prompt: "What's blocking this, and who owns the unblock?",
      title: 'Clarify the blocker',
      subtitle: 'Identify dependency and owner',
    },
    {
      prompt: 'Who can help resolve this faster?',
      title: 'Suggest helpers',
      subtitle: 'Find the right support',
    },
    {
      prompt: 'Draft a short update for stakeholders about this blocker.',
      title: 'Draft an update',
      subtitle: 'Share context without noise',
    },
  ],
  drift: [
    {
      prompt: 'What changed here, and why does it matter?',
      title: 'Explain the drift',
      subtitle: 'Surface scope or priority shifts',
    },
    {
      prompt: 'What is the risk if we keep the new scope?',
      title: 'Assess impact',
      subtitle: 'Quantify trade-offs',
    },
    {
      prompt: 'Suggest a decision path to realign priorities.',
      title: 'Propose next steps',
      subtitle: 'Bring it back on track',
    },
  ],
  stalled: [
    {
      prompt: 'Why is this stalled, and what is the fastest unblock?',
      title: 'Find the cause',
      subtitle: 'Surface hidden friction',
    },
    {
      prompt: 'Who should I check in with on this item?',
      title: 'Check in',
      subtitle: 'Nudge the right person',
    },
    {
      prompt: 'Is this still relevant, or should we pause it?',
      title: 'Triage relevance',
      subtitle: 'Reduce wasted work',
    },
  ],
  update: [
    {
      prompt: 'Summarize the real impact of this update.',
      title: 'Summarize impact',
      subtitle: 'Highlight what changed',
    },
    {
      prompt: 'Draft a stakeholder update about this.',
      title: 'Share context',
      subtitle: 'Keep everyone aligned',
    },
    {
      prompt: 'What is the best next action?',
      title: 'Recommend action',
      subtitle: 'Move forward intentionally',
    },
  ],
  coverage: [
    {
      prompt: 'Who is overloaded and who has capacity?',
      title: 'Balance workload',
      subtitle: 'See capacity clearly',
    },
    {
      prompt: 'Suggest a reassignment plan to reduce risk.',
      title: 'Reassign work',
      subtitle: 'Protect delivery',
    },
    {
      prompt: 'Draft a check-in message for the team lead.',
      title: 'Check in',
      subtitle: 'Support without micromanaging',
    },
  ],
  risk: [
    {
      prompt: 'What are the top risks and their root causes?',
      title: 'Surface risks',
      subtitle: 'Get the real story',
    },
    {
      prompt: 'What is the smallest action to reduce this risk?',
      title: 'Mitigate quickly',
      subtitle: 'Focus on leverage',
    },
    {
      prompt: 'Draft a risk update for stakeholders.',
      title: 'Communicate risk',
      subtitle: 'Share early, not late',
    },
  ],
  action_required: [
    {
      prompt: 'Who should own this, and why?',
      title: 'Assign ownership',
      subtitle: 'Match strengths to work',
    },
    {
      prompt: 'Break this into the smallest next steps.',
      title: 'Break it down',
      subtitle: 'Make progress easy',
    },
    {
      prompt: 'Draft a short decision request for the team.',
      title: 'Request decision',
      subtitle: 'Move with clarity',
    },
  ],
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

          <InboxAssistantThinking label="Linea is working on this..." />

          <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto w-full flex flex-col gap-4 overflow-visible pb-4">
            <ThreadScrollToBottom />
            <InboxComposer />
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>

      <LineaToolRegistry />
    </div>
  );
}

export function GeneralLineaThread({ threadId }: { threadId: string }) {
  const api = useAssistantApi();

  useEffect(() => {
    if (threadId) {
      api.threads().switchToThread(threadId);
    }
  }, [threadId, api]);

  return (
    <div className="flex flex-col h-11/12">
      <ThreadPrimitive.Root className="aui-thread-root flex-1 flex flex-col min-h-0 bg-background">
        <ThreadPrimitive.Viewport
          turnAnchor="top"
          className="aui-thread-viewport flex-1 flex flex-col overflow-y-auto scroll-smooth px-6 pt-4"
        >
          <AssistantIf condition={({ thread }) => thread.isEmpty}>
            <GeneralThreadWelcome />
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

          <InboxAssistantThinking label="Linea is thinking..." />

          <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto w-full flex flex-col gap-4 overflow-visible pb-4">
            <ThreadScrollToBottom />
            <InboxComposer placeholder="Ask Linea anything..." />
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>

      <LineaToolRegistry />
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
  const suggestions = suggestionConfig[context.type] || suggestionConfig.update;

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
            I&apos;m here to help you with this {typeInfo.label.toLowerCase()}.
            Ask me anything or try one of the suggestions below.
          </p>

          <div className="mb-6 w-full max-w-xl rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-foreground">
                {context.title}
              </div>
              <Badge variant="outline" className="text-xs capitalize">
                {context.priority.replace('_', ' ')}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="text-foreground/70">Type</span>
                {typeInfo.label}
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {context.summary
                ? context.summary
                : 'No summary yet. Ask Linea to pull context from Linear or Slack.'}
            </p>
          </div>

          {/* Quick action suggestions */}
          <div className="aui-thread-welcome-suggestions grid gap-2 md:grid-cols-3 w-full max-w-2xl">
            {suggestions.map((suggestion, index) => (
              <ThreadPrimitive.Suggestion
                key={suggestion.title}
                prompt={suggestion.prompt}
                send
                asChild
              >
                <Button
                  variant="outline"
                  className={cn(
                    'aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both h-auto flex-col items-start justify-start gap-1 rounded-xl px-4 py-3 text-left transition-all hover:bg-accent/50 hover:border-accent-foreground/20 hover:shadow-sm',
                    index === 0 && 'duration-200 delay-100',
                    index === 1 && 'duration-200 delay-150',
                    index === 2 && 'duration-200 delay-200',
                  )}
                >
                  <span className="aui-thread-welcome-suggestion-text-1 font-medium text-sm">
                    {suggestion.title}
                  </span>
                  <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-xs">
                    {suggestion.subtitle}
                  </span>
                </Button>
              </ThreadPrimitive.Suggestion>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneralThreadWelcome() {
  const suggestions = [
    {
      prompt: 'What should I focus on today?',
      title: 'Daily focus',
      subtitle: 'Surface blockers, risks, and wins',
    },
    {
      prompt: 'Summarize the latest product signals.',
      title: 'Team pulse',
      subtitle: 'Linear, Slack, GitHub, Calendar',
    },
    {
      prompt: 'Schedule a heartbeat digest every weekday morning.',
      title: 'Set a heartbeat',
      subtitle: 'Recurring updates to stay aligned',
    },
  ];

  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex w-full flex-col items-center justify-center px-4 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-primary/10 text-primary fade-in slide-in-from-bottom-1 animate-in duration-300">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="aui-thread-welcome-heading fade-in slide-in-from-bottom-1 animate-in font-semibold text-2xl duration-200 mb-2">
            Always-on Linea
          </h1>
          <p className="aui-thread-welcome-subheading fade-in slide-in-from-bottom-1 animate-in text-muted-foreground text-lg delay-75 duration-200 max-w-md mb-6">
            This is your main workspace thread. Ask anything, schedule work, or
            get a quick read on how the team is doing.
          </p>

          <div className="aui-thread-welcome-suggestions grid gap-2 md:grid-cols-3 w-full max-w-2xl">
            {suggestions.map((suggestion, index) => (
              <ThreadPrimitive.Suggestion
                key={suggestion.title}
                prompt={suggestion.prompt}
                send
                asChild
              >
                <Button
                  variant="outline"
                  className={cn(
                    'aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both h-auto flex-col items-start justify-start gap-1 rounded-xl px-4 py-3 text-left transition-all hover:bg-accent/50 hover:border-accent-foreground/20 hover:shadow-sm',
                    index === 0 && 'duration-200 delay-100',
                    index === 1 && 'duration-200 delay-150',
                    index === 2 && 'duration-200 delay-200',
                  )}
                >
                  <span className="aui-thread-welcome-suggestion-text-1 font-medium text-sm">
                    {suggestion.title}
                  </span>
                  <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-xs">
                    {suggestion.subtitle}
                  </span>
                </Button>
              </ThreadPrimitive.Suggestion>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
