'use client';

import { useMemo } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Terminal, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils';

type RunSandboxWorkflowArgs = {
  goal: string;
  sourceSkill?: string;
  saveSkill?: boolean;
  steps: Array<{ name: string; command: string }>;
  timeoutMs?: number;
  image?: string;
  persistWorkspace?: boolean;
  sessionId?: string;
  keepAlive?: boolean;
  closeSession?: boolean;
};

type SandboxWorkflowStepResult = {
  name: string;
  command: string;
  output: string;
  exitCode: number | null;
  durationMs: number;
  truncated: boolean;
  timedOut?: boolean;
};

type SandboxWorkflowResult = {
  goal: string;
  steps: SandboxWorkflowStepResult[];
  success: boolean;
  exitCode: number | null;
  durationMs: number;
  truncated: boolean;
  containerId?: string;
  persistedWorkspace?: boolean;
  summary?: string;
  skillSaved?: boolean;
  skillSaveError?: string | null;
  skillTitle?: string | null;
  sessionId?: string;
  sessionStatus?: 'active' | 'closed' | 'expired' | 'not_found';
};

function parseSandboxWorkflowResult(result: unknown): SandboxWorkflowResult | null {
  if (!result) return null;
  if (typeof result === 'object' && result !== null) {
    const candidate = result as SandboxWorkflowResult;
    if (Array.isArray(candidate.steps)) {
      return candidate;
    }
  }

  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result) as SandboxWorkflowResult;
      if (Array.isArray(parsed.steps)) {
        return parsed;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export const RunSandboxWorkflowToolUI = makeAssistantToolUI<
  RunSandboxWorkflowArgs,
  unknown
>({
  toolName: 'run_sandbox_workflow',
  render: function RunSandboxWorkflowUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const parsed = useMemo(() => parseSandboxWorkflowResult(result), [result]);
    const workflowSteps = args.steps || [];
    const resultSteps = parsed?.steps || [];
    const totalSteps = workflowSteps.length;
    const completedCount = Math.min(resultSteps.length, totalSteps);
    const progressPercent = totalSteps
      ? Math.round((completedCount / totalSteps) * 100)
      : 0;
    const currentIndex =
      isRunning && completedCount < totalSteps ? completedCount : null;
    const truncated = parsed?.truncated ?? false;
    const durationMs = parsed?.durationMs ?? null;
    const exitCode = parsed?.exitCode ?? null;
    const summary = parsed?.summary || '';
    const skillSaved = parsed?.skillSaved;
    const skillSaveError = parsed?.skillSaveError;
    const sessionId = parsed?.sessionId ?? args.sessionId;
    const sessionStatus = parsed?.sessionStatus;
    const sourceSkill =
      typeof args.sourceSkill === 'string' && args.sourceSkill.trim().length > 0
        ? args.sourceSkill.trim()
        : null;

    return (
      <Card className="w-full max-w-3xl overflow-hidden my-2">
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-medium text-foreground">
              {isRunning ? 'Running sandbox workflow...' : 'Sandbox Workflow'}
            </p>
            {args.image && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {args.image}
              </Badge>
            )}
            {sourceSkill && (
              <Badge variant="outline" className="text-[10px]">
                Skill: {sourceSkill}
              </Badge>
            )}
            {args.saveSkill === false && (
              <Badge variant="outline" className="text-[10px]">
                Save skill: off
              </Badge>
            )}
            {sessionId && (
              <Badge variant="outline" className="text-[10px]">
                Session {sessionId.slice(0, 8)}
              </Badge>
            )}
            {sessionStatus && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px]',
                  sessionStatus === 'active' && 'text-status-success',
                  sessionStatus === 'closed' && 'text-muted-foreground',
                  sessionStatus === 'expired' && 'text-status-warning',
                  sessionStatus === 'not_found' && 'text-destructive',
                )}
              >
                {sessionStatus.replace('_', ' ')}
              </Badge>
            )}
            {args.keepAlive && (
              <Badge variant="outline" className="text-[10px]">
                Keep alive
              </Badge>
            )}
            {args.closeSession && (
              <Badge variant="outline" className="text-[10px]">
                Close session
              </Badge>
            )}
            {args.persistWorkspace !== undefined && (
              <Badge variant="outline" className="text-[10px]">
                {args.persistWorkspace ? 'Persisted' : 'Ephemeral'}
              </Badge>
            )}
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground mb-2">Goal</p>
            <p className="text-sm text-foreground">{args.goal}</p>
          </div>

          {isRunning && totalSteps > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {completedCount}/{totalSteps} steps complete
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-foreground/60 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {isRunning && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Workflow is executing...</span>
            </div>
          )}

          <div className="space-y-3">
            {workflowSteps.map((step, index) => {
              const stepResult = resultSteps[index];
              const stepExit = stepResult?.exitCode ?? null;
              const stepTimedOut = stepResult?.timedOut ?? false;
              const isCurrent = isRunning && currentIndex === index && !stepResult;
              const statusLabel = stepResult
                ? stepTimedOut
                  ? 'Timed out'
                  : stepExit === 0
                    ? 'Success'
                    : stepExit === null
                      ? 'Failed'
                      : 'Failed'
                : isCurrent
                  ? 'Running'
                  : isRunning
                    ? 'Pending'
                    : 'Not run';

              return (
                <div
                  key={`${step.name}-${index}`}
                  className="rounded-lg border border-border/60 bg-background/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {index + 1}. {step.name}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        stepResult?.exitCode === 0 && 'text-status-success',
                        stepResult && stepResult.exitCode !== 0 && 'text-destructive',
                        stepTimedOut && 'text-status-warning',
                        isCurrent && 'text-status-info',
                      )}
                    >
                      {statusLabel}
                    </Badge>
                    {isCurrent && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    {stepResult?.durationMs !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {stepResult.durationMs}ms
                      </span>
                    )}
                  </div>
                  <div className="mt-2 rounded border border-border/60 bg-muted/30 p-2">
                    <p className="text-[11px] text-muted-foreground mb-1">
                      Command
                    </p>
                    <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                      {step.command}
                    </pre>
                  </div>
                  {stepResult && (
                    <div className="mt-2 rounded border border-border/60 bg-background/80 p-2">
                      <p className="text-[11px] text-muted-foreground mb-1">
                        Output
                      </p>
                      <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                        {stepResult.output || 'No output returned.'}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isRunning && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Exit code:{' '}
                  <span
                    className={cn(
                      'font-medium',
                      exitCode === 0 && 'text-status-success',
                      exitCode !== null && exitCode !== 0 && 'text-destructive',
                    )}
                  >
                    {exitCode === null ? '—' : exitCode}
                  </span>
                </span>
                <span>•</span>
                <span>Duration: {durationMs ? `${durationMs}ms` : '—'}</span>
                {truncated && (
                  <Badge variant="outline" className="text-[10px]">
                    Output truncated
                  </Badge>
                )}
              </div>
              {summary && (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  {parsed?.success ? (
                    <CheckCircle className="h-4 w-4 text-status-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>{summary}</span>
                </div>
              )}
              {skillSaved && (
                <div className="flex items-center gap-2 text-xs text-status-success">
                  <CheckCircle className="h-3 w-3" />
                  <span>Skill saved{parsed?.skillTitle ? `: ${parsed.skillTitle}` : ''}</span>
                </div>
              )}
              {!skillSaved && skillSaveError && (
                <div className="flex items-center gap-2 text-xs text-status-warning">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{skillSaveError}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});
