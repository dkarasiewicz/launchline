'use client';

/**
 * Linea Chat Component
 *
 * A standalone chat interface for talking with Linea when no inbox item is selected.
 * This is the primary demo experience - users can ask about their team directly.
 */

import { ThreadPrimitive, AssistantIf } from '@assistant-ui/react';
import { Button } from '../ui/button';
import {
  ArrowDownIcon,
  Zap,
  Users,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Target,
  Sparkles,
} from 'lucide-react';

import { InboxComposer } from './inbox-composer';
import { InboxUserMessage, InboxAssistantMessage } from './inbox-messages';

// Tool UIs - All registered tools
import {
  UpdateLinearTicketToolUI,
  SendSlackMessageToolUI,
  InternetSearchToolUI,
  CreateGitHubIssueToolUI,
  ThinkToolUI,
  WriteTodosToolUI,
  SearchMemoriesTool,
  SaveMemoryTool,
  GetBlockersTool,
  GetDecisionsTool,
  ResolveIdentityTool,
  GetInboxItemsTool,
  GetWorkspaceStatusTool,
  GetLinearIssuesTool,
  GetLinearIssueDetailsTool,
  SearchLinearIssuesTool,
  GetLinearProjectStatusTool,
  GetLinearTeamWorkloadTool,
  GetLinearCycleStatusTool,
  AddLinearCommentTool,
  GenerateProjectUpdateTool,
} from '../tool-ui';
import { LogoIcon } from '../logo';

/**
 * Main Linea Chat Interface
 */
export function LineaChat() {
  return (
    <div className="flex flex-col h-full">
      {/* Thread Messages - scrollable area */}
      <ThreadPrimitive.Root className="aui-thread-root flex-1 flex flex-col min-h-0 bg-background">
        <ThreadPrimitive.Viewport
          turnAnchor="top"
          className="aui-thread-viewport flex-1 flex flex-col overflow-y-auto scroll-smooth px-6 pt-4"
        >
          <AssistantIf condition={({ thread }) => thread.isEmpty}>
            <LineaChatWelcome />
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
      {/* Memory tools */}
      <SearchMemoriesTool />
      <SaveMemoryTool />
      <GetBlockersTool />
      <GetDecisionsTool />
      <ResolveIdentityTool />
      {/* Inbox tools */}
      <GetInboxItemsTool />
      <GetWorkspaceStatusTool />
      {/* Linear skills */}
      <GetLinearIssuesTool />
      <GetLinearIssueDetailsTool />
      <SearchLinearIssuesTool />
      <GetLinearProjectStatusTool />
      <GetLinearTeamWorkloadTool />
      <GetLinearCycleStatusTool />
      <AddLinearCommentTool />
      {/* Project update */}
      <GenerateProjectUpdateTool />
      {/* Human-in-the-loop Approval UIs */}
      <UpdateLinearTicketToolUI />
      <SendSlackMessageToolUI />
      <InternetSearchToolUI />
      <CreateGitHubIssueToolUI />
      <ThinkToolUI />
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
 * LineaChatWelcome - Welcome message with demo-ready suggestions
 *
 * These suggestions are designed to showcase the product value:
 * - Sprint status → proactive, actionable response
 * - Team workload → surface who needs help
 * - Hidden impact → show work beyond ticket counts
 * - Blockers → immediate visibility into problems
 */
function LineaChatWelcome() {
  const demoSteps = [
    {
      title: '1. Sprint status',
      prompt: "How's the sprint going? Any blockers I should know about?",
      detail: 'Proactive overview with risks',
    },
    {
      title: '2. Hidden impact',
      prompt:
        "I noticed Sarah hasn't closed many tickets recently. What's she actually been working on?",
      detail: 'Show invisible contributions',
    },
    {
      title: '3. Actionable update',
      prompt:
        "Generate a project update for stakeholders - what shipped, what's coming, any risks?",
      detail: 'Turn signals into decisions',
    },
  ];

  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex w-full flex-col items-center justify-center px-4 text-center">
          {/* Logo */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mb-6 fade-in slide-in-from-bottom-1 animate-in duration-300">
            <LogoIcon className="w-15 h-15 text-violet-400" />
          </div>

          {/* Greeting */}
          <h1 className="aui-thread-welcome-heading fade-in slide-in-from-bottom-1 animate-in font-semibold text-2xl duration-200 mb-2">
            Hi, I&apos;m Linea
          </h1>
          <p className="aui-thread-welcome-subheading fade-in slide-in-from-bottom-1 animate-in text-muted-foreground text-lg delay-75 duration-200 max-w-xl mb-8">
            Your execution inbox for hidden blockers, quiet wins, and priority
            drift. Clarity without micromanagement.
          </p>

          {/* Demo flow */}
          <div className="mb-6 w-full max-w-3xl rounded-2xl border border-border/60 bg-muted/30 px-4 py-4 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Demo flow
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {demoSteps.map((step) => (
                <ThreadPrimitive.Suggestion
                  key={step.title}
                  prompt={step.prompt}
                  send
                  asChild
                >
                  <Button
                    variant="outline"
                    className="h-auto flex-col items-start justify-start gap-1.5 rounded-xl px-3 py-2 text-left text-xs whitespace-normal transition-colors duration-150 hover:bg-accent/50 hover:border-accent-foreground/20"
                  >
                    <span className="font-semibold text-foreground">
                      {step.title}
                    </span>
                    <span className="text-muted-foreground leading-snug">
                      {step.detail}
                    </span>
                  </Button>
                </ThreadPrimitive.Suggestion>
              ))}
            </div>
          </div>

          {/* Demo-ready suggestion prompts - 2x3 grid */}
          <div className="aui-thread-welcome-suggestions grid gap-3 md:grid-cols-2 lg:grid-cols-3 w-full max-w-3xl">
            {/* Sprint Status - Shows proactive response */}
            <ThreadPrimitive.Suggestion
              prompt="How's the sprint going? Any blockers I should know about?"
              send
              asChild
            >
              <Button
                variant="outline"
                className="aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200 delay-100 h-auto min-h-[104px] flex-col items-start justify-start gap-1.5 rounded-xl px-4 py-4 text-left whitespace-normal break-words transition-colors duration-150 ease-out hover:bg-accent/50 hover:border-violet-500/30 group"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-violet-400 group-hover:text-violet-500" />
                  <span className="font-medium text-sm">Sprint status</span>
                </div>
                <span className="text-muted-foreground text-xs leading-snug">
                  Get a proactive overview with blockers and risks
                </span>
              </Button>
            </ThreadPrimitive.Suggestion>

            {/* Team Workload - Shows distribution */}
            <ThreadPrimitive.Suggestion
              prompt="Show me the team workload. Who might need help?"
              send
              asChild
            >
              <Button
                variant="outline"
                className="aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200 delay-150 h-auto min-h-[104px] flex-col items-start justify-start gap-1.5 rounded-xl px-4 py-4 text-left whitespace-normal break-words transition-colors duration-150 ease-out hover:bg-accent/50 hover:border-blue-500/30 group"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400 group-hover:text-blue-500" />
                  <span className="font-medium text-sm">Team workload</span>
                </div>
                <span className="text-muted-foreground text-xs leading-snug">
                  See who&apos;s overloaded or has capacity
                </span>
              </Button>
            </ThreadPrimitive.Suggestion>

            {/* Hidden Impact - The key differentiator */}
            <ThreadPrimitive.Suggestion
              prompt="I noticed Sarah hasn't closed many tickets recently. What's she actually been working on?"
              send
              asChild
            >
              <Button
                variant="outline"
                className="aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200 delay-200 h-auto min-h-[104px] flex-col items-start justify-start gap-1.5 rounded-xl px-4 py-4 text-left whitespace-normal break-words transition-colors duration-150 ease-out hover:bg-accent/50 hover:border-emerald-500/30 group"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400 group-hover:text-emerald-500" />
                  <span className="font-medium text-sm">Hidden impact</span>
                </div>
                <span className="text-muted-foreground text-xs leading-snug">
                  Discover work beyond ticket counts
                </span>
              </Button>
            </ThreadPrimitive.Suggestion>

            {/* Active Blockers */}
            <ThreadPrimitive.Suggestion
              prompt="What are the active blockers right now? Anything stuck for too long?"
              send
              asChild
            >
              <Button
                variant="outline"
                className="aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200 delay-250 h-auto min-h-[104px] flex-col items-start justify-start gap-1.5 rounded-xl px-4 py-4 text-left whitespace-normal break-words transition-colors duration-150 ease-out hover:bg-accent/50 hover:border-rose-500/30 group"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 group-hover:text-rose-500" />
                  <span className="font-medium text-sm">Active blockers</span>
                </div>
                <span className="text-muted-foreground text-xs leading-snug">
                  Find what&apos;s stuck and needs attention
                </span>
              </Button>
            </ThreadPrimitive.Suggestion>

            {/* Priority Drift */}
            <ThreadPrimitive.Suggestion
              prompt="Has anything changed priority without me knowing? Any drift I should review?"
              send
              asChild
            >
              <Button
                variant="outline"
                className="aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200 delay-300 h-auto min-h-[104px] flex-col items-start justify-start gap-1.5 rounded-xl px-4 py-4 text-left whitespace-normal break-words transition-colors duration-150 ease-out hover:bg-accent/50 hover:border-amber-500/30 group"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400 group-hover:text-amber-500" />
                  <span className="font-medium text-sm">Priority drift</span>
                </div>
                <span className="text-muted-foreground text-xs leading-snug">
                  Catch shifting priorities early
                </span>
              </Button>
            </ThreadPrimitive.Suggestion>

            {/* Project Update */}
            <ThreadPrimitive.Suggestion
              prompt="Generate a project update for stakeholders - what shipped, what's coming, any risks?"
              send
              asChild
            >
              <Button
                variant="outline"
                className="aui-thread-welcome-suggestion fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200 delay-350 h-auto min-h-[104px] flex-col items-start justify-start gap-1.5 rounded-xl px-4 py-4 text-left whitespace-normal break-words transition-colors duration-150 ease-out hover:bg-accent/50 hover:border-sky-500/30 group"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-sky-400 group-hover:text-sky-500" />
                  <span className="font-medium text-sm">Project update</span>
                </div>
                <span className="text-muted-foreground text-xs leading-snug">
                  Generate stakeholder-ready summaries
                </span>
              </Button>
            </ThreadPrimitive.Suggestion>
          </div>

          {/* Tagline */}
          <p className="text-xs text-muted-foreground/70 mt-8 fade-in animate-in delay-500 duration-300">
            Transparency without micromanagement. Impact without fake KPIs.
          </p>
        </div>
      </div>
    </div>
  );
}
