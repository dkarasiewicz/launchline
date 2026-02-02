'use client';

import { useMemo } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Terminal, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

type RunSandboxCommandArgs = {
  command: string;
  timeoutMs?: number;
  image?: string;
};

type SandboxResult = {
  output: string;
  exitCode: number | null;
  durationMs: number;
  truncated: boolean;
  containerId?: string;
};

function parseSandboxResult(result: unknown): SandboxResult | null {
  if (!result) return null;
  if (typeof result === 'object' && result !== null) {
    const candidate = result as SandboxResult;
    if (typeof candidate.output === 'string') {
      return candidate;
    }
  }

  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result) as SandboxResult;
      if (typeof parsed.output === 'string') {
        return parsed;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export const RunSandboxCommandToolUI = makeAssistantToolUI<
  RunSandboxCommandArgs,
  unknown
>({
  toolName: 'run_sandbox_command',
  render: function RunSandboxCommandUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const parsed = useMemo(() => parseSandboxResult(result), [result]);
    const exitCode = parsed?.exitCode ?? null;
    const durationMs = parsed?.durationMs ?? null;
    const truncated = parsed?.truncated ?? false;
    const output = parsed?.output || (typeof result === 'string' ? result : '');

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-medium text-foreground">
              {isRunning ? 'Running sandbox command...' : 'Sandbox Command'}
            </p>
            {args.image && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {args.image}
              </Badge>
            )}
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground mb-2">Command</p>
            <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
              {args.command}
            </pre>
          </div>

          {isRunning ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Container is executing...</span>
            </div>
          ) : (
            <>
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
                <span>
                  Duration: {durationMs ? `${durationMs}ms` : '—'}
                </span>
                {truncated && (
                  <Badge variant="outline" className="text-[10px]">
                    Output truncated
                  </Badge>
                )}
              </div>

              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-xs text-muted-foreground mb-2">Output</p>
                <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                  {output || 'No output returned.'}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  },
});
