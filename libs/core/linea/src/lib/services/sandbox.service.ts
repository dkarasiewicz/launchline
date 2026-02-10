import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { ExecuteResponse, SandboxBackendProtocol } from 'deepagents';
import { DenoSandboxRegion, SandboxLifetime } from '@langchain/deno';

export type SandboxRunResult = {
  output: string;
  exitCode: number | null;
  durationMs: number;
  truncated: boolean;
  containerId?: string;
};

export type SandboxWorkflowStep = {
  name: string;
  command: string;
};

export type SandboxWorkflowStepResult = {
  name: string;
  command: string;
  output: string;
  exitCode: number | null;
  durationMs: number;
  truncated: boolean;
  timedOut?: boolean;
};

export type SandboxWorkflowResult = {
  goal: string;
  steps: SandboxWorkflowStepResult[];
  success: boolean;
  exitCode: number | null;
  durationMs: number;
  truncated: boolean;
  containerId?: string;
  persistedWorkspace: boolean;
  summary: string;
  sessionId?: string;
  sessionStatus?: 'active' | 'closed' | 'expired' | 'not_found';
};

type ManagedSandbox = SandboxBackendProtocol & {
  close?: () => Promise<void>;
  stop?: () => Promise<void>;
};

type SandboxSession = {
  id: string;
  workspaceId: string;
  sandbox: ManagedSandbox;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  provider: string;
  persistWorkspace: boolean;
};

type ExecuteOutcome = {
  output: string;
  exitCode: number | null;
  truncated: boolean;
  timedOut: boolean;
};

class SandboxTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxTimeoutError';
  }
}

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);
  private readonly provider: string;
  private readonly outputLimit: number;
  private readonly sessionTtlMs: number;
  private readonly maxSessions: number;
  private readonly workflowMaxSteps: number;
  private readonly workflowTimeoutMs: number;
  private readonly sandboxTimeoutMs: number;
  private readonly sessions = new Map<string, SandboxSession>();

  constructor(private readonly configService: ConfigService) {
    this.provider = (
      this.configService.get<string>('linea.sandbox.provider') ||
      process.env['LINEA_SANDBOX_PROVIDER'] ||
      'node-vfs'
    ).toLowerCase();
    this.outputLimit = Number(
      process.env['LINEA_SANDBOX_OUTPUT_LIMIT'] || '12000',
    );
    this.sessionTtlMs = Number(
      process.env['LINEA_SANDBOX_SESSION_TTL_MS'] || '1800000',
    );
    this.maxSessions = Number(process.env['LINEA_SANDBOX_MAX_SESSIONS'] || '8');
    this.workflowMaxSteps = Number(
      process.env['LINEA_SANDBOX_WORKFLOW_MAX_STEPS'] || '30',
    );
    this.workflowTimeoutMs = Number(
      process.env['LINEA_SANDBOX_WORKFLOW_TIMEOUT_MS'] || '1800000',
    );
    this.sandboxTimeoutMs = Number(
      process.env['LINEA_SANDBOX_TIMEOUT_MS'] || '120000',
    );
  }

  async runCommand(input: {
    workspaceId: string;
    command: string;
    timeoutMs?: number;
    image?: string;
  }): Promise<SandboxRunResult> {
    const startedAt = Date.now();
    try {
      const workflow = await this.runWorkflow({
        workspaceId: input.workspaceId,
        goal: 'execute',
        steps: [{ name: 'execute', command: input.command }],
        timeoutMs: input.timeoutMs,
        persistWorkspace: false,
        keepAlive: false,
      });
      const step = workflow.steps[0];
      return {
        output: step?.output ?? workflow.summary,
        exitCode: step?.exitCode ?? workflow.exitCode,
        durationMs: Date.now() - startedAt,
        truncated: step?.truncated ?? workflow.truncated,
      };
    } catch (error) {
      this.logger.error(
        { err: error, workspaceId: input.workspaceId },
        'Sandbox command failed',
      );
      return {
        output: error instanceof Error ? error.message : 'Sandbox error',
        exitCode: null,
        durationMs: Date.now() - startedAt,
        truncated: false,
      };
    }
  }

  async runWorkflow(input: {
    workspaceId: string;
    goal: string;
    steps: SandboxWorkflowStep[];
    timeoutMs?: number;
    image?: string;
    persistWorkspace?: boolean;
    sessionId?: string;
    keepAlive?: boolean;
    closeSession?: boolean;
  }): Promise<SandboxWorkflowResult> {
    const startedAt = Date.now();
    let persistWorkspace = input.persistWorkspace ?? true;
    const keepAlive = input.keepAlive ?? false;
    const closeSession = input.closeSession ?? false;
    const requestedSessionId = input.sessionId;
    const maxSteps = this.workflowMaxSteps;
    const maxTimeoutMs = this.workflowTimeoutMs;
    const timeoutMs = Math.min(input.timeoutMs ?? maxTimeoutMs, maxTimeoutMs);

    let sandbox: ManagedSandbox | null = null;
    let session: SandboxSession | null = null;
    let sessionStatus: SandboxWorkflowResult['sessionStatus'];
    let responseSessionId: string | undefined;
    let preserveSandbox = false;
    let ephemeralSandbox: ManagedSandbox | null = null;

    try {
      if (closeSession && !requestedSessionId) {
        throw new Error('closeSession requested but no sessionId provided.');
      }

      await this.pruneExpiredSessions();

      if (requestedSessionId) {
        session = this.sessions.get(requestedSessionId) ?? null;
        if (!session) {
          return {
            goal: input.goal,
            steps: [],
            success: false,
            exitCode: null,
            durationMs: Date.now() - startedAt,
            truncated: false,
            persistedWorkspace: persistWorkspace,
            summary: `Sandbox session ${requestedSessionId} not found.`,
            sessionId: requestedSessionId,
            sessionStatus: 'not_found',
          };
        }

        if (session.workspaceId !== input.workspaceId) {
          throw new Error('Sandbox session does not belong to this workspace.');
        }

        if (closeSession) {
          await this.closeSession(session, 'closed');
          return {
            goal: input.goal,
            steps: [],
            success: true,
            exitCode: 0,
            durationMs: Date.now() - startedAt,
            truncated: false,
            persistedWorkspace: session.persistWorkspace,
            summary: `Sandbox session ${session.id} closed.`,
            sessionId: session.id,
            sessionStatus: 'closed',
          };
        }

        sandbox = session.sandbox;
        responseSessionId = session.id;
        sessionStatus = 'active';
        persistWorkspace = session.persistWorkspace;
        session.lastUsedAt = Date.now();
        session.expiresAt = session.lastUsedAt + this.sessionTtlMs;
        preserveSandbox = true;
      }

      if (input.steps.length === 0) {
        throw new Error('Workflow must include at least one step.');
      }

      if (input.steps.length > maxSteps) {
        throw new Error(
          `Workflow has ${input.steps.length} steps, exceeding max ${maxSteps}.`,
        );
      }

      if (!sandbox) {
        if (persistWorkspace) {
          const workspaceSessionId = this.getWorkspaceSessionId(
            input.workspaceId,
          );
          session = await this.getOrCreateSession({
            sessionId: workspaceSessionId,
            workspaceId: input.workspaceId,
            persistWorkspace: true,
          });
          sandbox = session.sandbox;
          preserveSandbox = true;
          if (keepAlive) {
            responseSessionId = session.id;
            sessionStatus = 'active';
          }
        } else {
          sandbox = await this.createSandbox();
          ephemeralSandbox = sandbox;
          if (keepAlive) {
            await this.pruneExpiredSessions();
            if (this.sessions.size >= this.maxSessions) {
              await this.evictOldestSession();
            }
            const sessionId = randomUUID();
            session = this.buildSession(
              sessionId,
              input.workspaceId,
              sandbox,
              false,
            );
            this.sessions.set(sessionId, session);
            responseSessionId = sessionId;
            sessionStatus = 'active';
            preserveSandbox = true;
          }
        }
      }

      const deadline = Date.now() + timeoutMs;
      const stepResults: SandboxWorkflowStepResult[] = [];
      let truncated = false;
      let success = true;
      let failureStep: SandboxWorkflowStepResult | null = null;

      for (const step of input.steps) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          const timedOutStep: SandboxWorkflowStepResult = {
            name: step.name,
            command: step.command,
            output: 'Workflow timed out before this step could start.',
            exitCode: null,
            durationMs: 0,
            truncated: false,
            timedOut: true,
          };
          stepResults.push(timedOutStep);
          truncated = truncated || timedOutStep.truncated;
          success = false;
          failureStep = timedOutStep;
          break;
        }

        const stepResult = await this.executeStep(sandbox, step, remainingMs);
        stepResults.push(stepResult);
        truncated = truncated || stepResult.truncated;

        if (stepResult.timedOut || stepResult.exitCode !== 0) {
          success = false;
          failureStep = stepResult;
          break;
        }
      }

      const durationMs = Date.now() - startedAt;
      const exitCode = success ? 0 : (failureStep?.exitCode ?? null);
      const summary = this.buildWorkflowSummary(
        input.goal,
        success,
        stepResults,
        durationMs,
      );

      return {
        goal: input.goal,
        steps: stepResults,
        success,
        exitCode,
        durationMs,
        truncated,
        persistedWorkspace: persistWorkspace,
        summary,
        sessionId: responseSessionId,
        sessionStatus,
      };
    } catch (error) {
      this.logger.error(
        { err: error, workspaceId: input.workspaceId },
        'Sandbox workflow failed',
      );

      return {
        goal: input.goal,
        steps: [],
        success: false,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        truncated: false,
        persistedWorkspace: persistWorkspace,
        summary:
          error instanceof Error ? error.message : 'Sandbox workflow error',
        sessionId: responseSessionId,
        sessionStatus,
      };
    } finally {
      if (ephemeralSandbox && !preserveSandbox) {
        await this.closeSandbox(ephemeralSandbox);
      }
    }
  }

  async getWorkspaceSandbox(workspaceId: string): Promise<ManagedSandbox> {
    const session = await this.getOrCreateSession({
      sessionId: this.getWorkspaceSessionId(workspaceId),
      workspaceId,
      persistWorkspace: true,
    });

    return session.sandbox;
  }

  async executeCommand(input: {
    workspaceId: string;
    command: string;
    timeoutMs?: number;
  }): Promise<ExecuteResponse> {
    const sandbox = await this.getWorkspaceSandbox(input.workspaceId);
    const result = await this.executeStep(
      sandbox,
      { name: 'execute', command: input.command },
      input.timeoutMs ?? this.sandboxTimeoutMs,
    );
    return {
      output: result.output,
      exitCode: result.exitCode,
      truncated: result.truncated,
    };
  }

  private async executeStep(
    sandbox: ManagedSandbox,
    step: SandboxWorkflowStep,
    timeoutMs: number,
  ): Promise<SandboxWorkflowStepResult> {
    const startedAt = Date.now();
    const decoratedCommand = this.decorateCommand(step.command);

    const outcome = await this.executeWithTimeout(
      sandbox,
      decoratedCommand,
      timeoutMs,
    );

    return {
      name: step.name,
      command: step.command,
      output: outcome.output,
      exitCode: outcome.exitCode,
      durationMs: Date.now() - startedAt,
      truncated: outcome.truncated,
      timedOut: outcome.timedOut,
    };
  }

  private async executeWithTimeout(
    sandbox: ManagedSandbox,
    command: string,
    timeoutMs: number,
  ): Promise<ExecuteOutcome> {
    let timedOut = false;

    const execution = Promise.resolve(sandbox.execute(command));
    const timeoutPromise = new Promise<ExecuteResponse>((_, reject) => {
      const timeout = setTimeout(() => {
        timedOut = true;
        reject(new SandboxTimeoutError('Sandbox command timed out.'));
      }, timeoutMs);
      execution.finally(() => clearTimeout(timeout)).catch(() => undefined);
    });

    try {
      const result = await Promise.race([execution, timeoutPromise]);
      return this.normalizeExecuteOutcome(
        result.output,
        result.exitCode,
        result.truncated,
      );
    } catch (error) {
      if (this.isTimeoutError(error) || timedOut) {
        return {
          output: 'Command timed out.',
          exitCode: null,
          truncated: false,
          timedOut: true,
        };
      }

      const message = error instanceof Error ? error.message : 'Sandbox error';
      return {
        output: message,
        exitCode: null,
        truncated: false,
        timedOut: false,
      };
    }
  }

  private normalizeExecuteOutcome(
    output: string | undefined,
    exitCode: number | null | undefined,
    truncated: boolean | undefined,
  ): ExecuteOutcome {
    const sanitizedOutput = (output ?? '').trim();
    let normalized = sanitizedOutput;
    let wasTruncated = Boolean(truncated);

    if (normalized.length > this.outputLimit) {
      normalized = normalized.slice(0, this.outputLimit);
      wasTruncated = true;
    }

    return {
      output: normalized,
      exitCode: typeof exitCode === 'number' ? exitCode : null,
      truncated: wasTruncated,
      timedOut: false,
    };
  }

  private isTimeoutError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const code = (error as { code?: string }).code;
    if (code === 'COMMAND_TIMEOUT') {
      return true;
    }
    return (error as Error).name === 'SandboxTimeoutError';
  }

  private decorateCommand(command: string): string {
    return `${command}`;
  }

  private escapeShellValue(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private getWorkspaceSessionId(workspaceId: string): string {
    return `workspace:${workspaceId}`;
  }

  private async getOrCreateSession(input: {
    sessionId: string;
    workspaceId: string;
    persistWorkspace: boolean;
  }): Promise<SandboxSession> {
    const existing = this.sessions.get(input.sessionId);

    if (existing) {
      if (existing.workspaceId !== input.workspaceId) {
        throw new Error('Sandbox session does not belong to this workspace.');
      }

      existing.lastUsedAt = Date.now();
      existing.expiresAt = existing.lastUsedAt + this.sessionTtlMs;

      return existing;
    }

    await this.pruneExpiredSessions();

    if (this.sessions.size >= this.maxSessions) {
      await this.evictOldestSession();
    }

    const sandbox = await this.createSandbox();
    const session = this.buildSession(
      input.sessionId,
      input.workspaceId,
      sandbox,
      input.persistWorkspace,
    );

    this.sessions.set(input.sessionId, session);

    return session;
  }

  private buildSession(
    sessionId: string,
    workspaceId: string,
    sandbox: ManagedSandbox,
    persistWorkspace: boolean,
  ): SandboxSession {
    const now = Date.now();
    return {
      id: sessionId,
      workspaceId,
      sandbox,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: now + this.sessionTtlMs,
      provider: this.provider,
      persistWorkspace,
    };
  }

  private async pruneExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expired = Array.from(this.sessions.values()).filter(
      (session) => session.expiresAt <= now,
    );
    for (const session of expired) {
      await this.closeSession(session, 'expired');
    }
  }

  private async evictOldestSession(): Promise<void> {
    const oldest = Array.from(this.sessions.values()).sort(
      (a, b) => a.lastUsedAt - b.lastUsedAt,
    )[0];
    if (oldest) {
      await this.closeSession(oldest, 'expired');
    }
  }

  private async closeSession(
    session: SandboxSession,
    reason: 'closed' | 'expired',
  ): Promise<void> {
    this.sessions.delete(session.id);
    await this.closeSandbox(session.sandbox);
    this.logger.log(
      { sessionId: session.id, reason },
      'Sandbox session closed',
    );
  }

  private async closeSandbox(sandbox: ManagedSandbox): Promise<void> {
    try {
      if (typeof sandbox.close === 'function') {
        await sandbox.close();
        return;
      }
      if (typeof sandbox.stop === 'function') {
        await sandbox.stop();
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to close sandbox');
    }
  }

  private async createSandbox(): Promise<ManagedSandbox> {
    switch (this.provider) {
      case 'node-vfs':
        return this.createNodeVfsSandbox();
      case 'deno':
        return this.createDenoSandbox();
      default:
        throw new Error(
          `Unsupported sandbox provider "${this.provider}". ` +
            'Set LINEA_SANDBOX_PROVIDER to "node-vfs" or "deno".',
        );
    }
  }

  private async createNodeVfsSandbox(): Promise<ManagedSandbox> {
    try {
      const module = await import('@langchain/node-vfs');
      const sandbox = await module.VfsSandbox.create({
        timeout: this.sandboxTimeoutMs,
      });
      return sandbox as ManagedSandbox;
    } catch (error) {
      this.logger.error(
        { err: error },
        'Failed to initialize Node VFS sandbox. Ensure @langchain/node-vfs is installed.',
      );
      throw error;
    }
  }

  private async createDenoSandbox(): Promise<ManagedSandbox> {
    try {
      const module = await import('@langchain/deno');
      const memoryMb = Number(process.env['LINEA_SANDBOX_MEMORY_MB'] || '1024');
      const lifetime = (process.env['LINEA_SANDBOX_LIFETIME'] ||
        'session') as SandboxLifetime;
      const region = process.env['LINEA_SANDBOX_REGION'] as DenoSandboxRegion;
      const sandbox = await module.DenoSandbox.create({
        memoryMb,
        lifetime,
        region,
      });
      return sandbox as ManagedSandbox;
    } catch (error) {
      this.logger.error(
        { err: error },
        'Failed to initialize Deno sandbox. Ensure @langchain/deno is installed and configured.',
      );
      throw error;
    }
  }

  private buildWorkflowSummary(
    goal: string,
    success: boolean,
    steps: SandboxWorkflowStepResult[],
    durationMs: number,
  ): string {
    if (steps.length === 0) {
      return `Workflow "${goal}" did not run any steps.`;
    }

    if (success) {
      return `Workflow "${goal}" completed ${steps.length} step${
        steps.length === 1 ? '' : 's'
      } in ${durationMs}ms.`;
    }

    const failed = steps.find((step) => step.timedOut || step.exitCode !== 0);
    if (!failed) {
      return `Workflow "${goal}" failed after ${steps.length} step${
        steps.length === 1 ? '' : 's'
      }.`;
    }

    if (failed.timedOut) {
      return `Workflow "${goal}" timed out on step "${failed.name}".`;
    }

    return `Workflow "${goal}" failed on step "${failed.name}" (exit code ${
      failed.exitCode ?? 'unknown'
    }).`;
  }
}
