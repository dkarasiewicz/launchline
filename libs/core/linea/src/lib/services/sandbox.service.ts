import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PassThrough } from 'node:stream';
import { MemoryService } from './memory.service';

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
};

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);
  private readonly docker: Docker;
  private readonly image: string;
  private readonly outputLimit: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly memoryService: MemoryService,
  ) {
    this.docker = new Docker({
      socketPath: process.env['DOCKER_SOCKET'] || '/var/run/docker.sock',
    });
    this.image =
      this.configService.get<string>('linea.sandbox.image') ||
      process.env['LINEA_SANDBOX_IMAGE'] ||
      'mcr.microsoft.com/playwright:v1.50.0-jammy';
    this.outputLimit = Number(
      process.env['LINEA_SANDBOX_OUTPUT_LIMIT'] || '12000',
    );
  }

  async runCommand(input: {
    workspaceId: string;
    command: string;
    timeoutMs?: number;
    image?: string;
  }): Promise<SandboxRunResult> {
    const startedAt = Date.now();
    const timeoutMs = input.timeoutMs ?? 120_000;
    const image = input.image || this.image;
    let tempDir: string | null = null;

    try {
      await this.ensureImage(image);

      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'linea-sandbox-'));
      await this.writeSkills(tempDir, input.workspaceId);

      const binds: string[] = [];
      if (tempDir) {
        binds.push(`${tempDir}:/workspace`);
      }

      const container = await this.docker.createContainer({
        Image: image,
        Cmd: ['bash', '-lc', input.command],
        Tty: false,
        Env: ['SKILLS_DIR=/workspace/skills'],
        WorkingDir: '/workspace',
        HostConfig: {
          AutoRemove: true,
          NetworkMode: process.env['LINEA_SANDBOX_NETWORK'] || 'bridge',
          Binds: binds,
          Memory: Number(process.env['LINEA_SANDBOX_MEMORY'] || 536870912),
          CpuShares: Number(process.env['LINEA_SANDBOX_CPU_SHARES'] || 512),
        },
      });

      await container.start();

      const logs = await this.collectLogs(container, timeoutMs);
      const waitResult = await container.wait();

      return {
        output: logs.output,
        exitCode: waitResult.StatusCode ?? null,
        durationMs: Date.now() - startedAt,
        truncated: logs.truncated,
        containerId: container.id,
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
    } finally {
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  }

  async runWorkflow(input: {
    workspaceId: string;
    goal: string;
    steps: SandboxWorkflowStep[];
    timeoutMs?: number;
    image?: string;
    persistWorkspace?: boolean;
  }): Promise<SandboxWorkflowResult> {
    const startedAt = Date.now();
    const image = input.image || this.image;
    const persistWorkspace = input.persistWorkspace ?? true;
    const maxSteps = Number(
      process.env['LINEA_SANDBOX_WORKFLOW_MAX_STEPS'] || '30',
    );
    const maxTimeoutMs = Number(
      process.env['LINEA_SANDBOX_WORKFLOW_TIMEOUT_MS'] || '1800000',
    );
    const timeoutMs = Math.min(input.timeoutMs ?? maxTimeoutMs, maxTimeoutMs);

    let tempDir: string | null = null;
    let workspaceDir: string | null = null;
    let container: Docker.Container | null = null;

    try {
      if (input.steps.length > maxSteps) {
        throw new Error(
          `Workflow has ${input.steps.length} steps, exceeding max ${maxSteps}.`,
        );
      }

      await this.ensureImage(image);

      if (persistWorkspace) {
        const workspaceRoot =
          process.env['LINEA_SANDBOX_WORKSPACE_ROOT'] ||
          path.join(os.tmpdir(), 'linea-sandbox-workspaces');
        workspaceDir = path.join(workspaceRoot, input.workspaceId);
        await fs.mkdir(workspaceDir, { recursive: true });
      } else {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'linea-sandbox-'));
        workspaceDir = tempDir;
      }

      if (!workspaceDir) {
        throw new Error('Failed to initialize sandbox workspace directory.');
      }

      await this.writeSkills(workspaceDir, input.workspaceId, true);

      const binds: string[] = [];
      binds.push(`${workspaceDir}:/workspace`);

      container = await this.docker.createContainer({
        Image: image,
        Cmd: ['bash', '-lc', 'tail -f /dev/null'],
        Tty: false,
        Env: ['SKILLS_DIR=/workspace/skills'],
        WorkingDir: '/workspace',
        HostConfig: {
          AutoRemove: true,
          NetworkMode: process.env['LINEA_SANDBOX_NETWORK'] || 'bridge',
          Binds: binds,
          Memory: Number(process.env['LINEA_SANDBOX_MEMORY'] || 536870912),
          CpuShares: Number(process.env['LINEA_SANDBOX_CPU_SHARES'] || 512),
        },
      });

      await container.start();

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

        const stepResult = await this.runExecStep(container, step, remainingMs);
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
        containerId: container.id,
        persistedWorkspace: persistWorkspace,
        summary,
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
      };
    } finally {
      if (container) {
        try {
          await container.stop({ t: 2 });
        } catch {
          // ignore
        }
      }

      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  }

  private async ensureImage(image: string): Promise<void> {
    const images = await this.docker.listImages({
      filters: { reference: [image] },
    });
    if (images.length > 0) {
      return;
    }

    this.logger.log({ image }, 'Pulling sandbox image');

    const stream = await this.docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      const modem = (this.docker as unknown as { modem?: any }).modem;
      if (!modem?.followProgress) {
        stream.on('end', () => resolve());
        stream.on('error', (err) => reject(err));
        return;
      }

      modem.followProgress(stream, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async collectLogs(
    container: Docker.Container,
    timeoutMs: number,
  ): Promise<{ output: string; truncated: boolean }> {
    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
    });

    let output = '';
    let truncated = false;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(async () => {
        try {
          await container.stop({ t: 2 });
        } catch {
          // ignore
        }
        resolve();
      }, timeoutMs);

      logStream.on('data', (chunk: Buffer) => {
        if (truncated) {
          return;
        }
        const next = chunk.toString('utf8');
        if (output.length + next.length > this.outputLimit) {
          output += next.slice(0, this.outputLimit - output.length);
          truncated = true;
          return;
        }
        output += next;
      });
      logStream.on('end', () => {
        clearTimeout(timeout);
        resolve();
      });
      logStream.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return { output: output.trim(), truncated };
  }

  private async runExecStep(
    container: Docker.Container,
    step: SandboxWorkflowStep,
    timeoutMs: number,
  ): Promise<SandboxWorkflowStepResult> {
    const startedAt = Date.now();
    const exec = await container.exec({
      Cmd: ['bash', '-lc', step.command],
      AttachStdout: true,
      AttachStderr: true,
    });

    const { output, truncated, timedOut } = await this.collectExecLogs(
      container,
      exec,
      timeoutMs,
    );

    let exitCode: number | null = null;
    try {
      const inspect = await exec.inspect();
      if (typeof inspect.ExitCode === 'number') {
        exitCode = inspect.ExitCode;
      }
    } catch {
      exitCode = null;
    }

    return {
      name: step.name,
      command: step.command,
      output,
      exitCode: timedOut ? null : exitCode,
      durationMs: Date.now() - startedAt,
      truncated,
      timedOut,
    };
  }

  private async collectExecLogs(
    container: Docker.Container,
    exec: Docker.Exec,
    timeoutMs: number,
  ): Promise<{ output: string; truncated: boolean; timedOut: boolean }> {
    const stream = await exec.start({ hijack: true, stdin: false });
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const modem = (this.docker as unknown as { modem?: any }).modem;

    if (modem?.demuxStream) {
      modem.demuxStream(stream, stdout, stderr);
    } else {
      stream.pipe(stdout);
    }

    let output = '';
    let truncated = false;
    let timedOut = false;

    const append = (chunk: Buffer) => {
      if (truncated) {
        return;
      }
      const next = chunk.toString('utf8');
      if (output.length + next.length > this.outputLimit) {
        output += next.slice(0, this.outputLimit - output.length);
        truncated = true;
        return;
      }
      output += next;
    };

    stdout.on('data', append);
    stderr.on('data', append);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(async () => {
        timedOut = true;
        try {
          await container.stop({ t: 2 });
        } catch {
          // ignore
        }
        resolve();
      }, timeoutMs);

      const done = () => {
        clearTimeout(timeout);
        resolve();
      };

      stream.on('end', done);
      stream.on('close', done);
      stream.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      stdout.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      stderr.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return { output: output.trim(), truncated, timedOut };
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

    return `Workflow "${goal}" failed on step "${failed.name}" (exit code ${failed.exitCode ?? 'unknown'}).`;
  }

  private async getSkillFiles(
    workspaceId: string,
  ): Promise<Array<{ name: string; fileName: string; content: string }>> {
    const memories = await this.memoryService.listMemories(
      workspaceId,
      'workspace',
      { limit: 50 },
    );

    const skills = memories.filter((memory) => memory.category === 'skill');

    return skills.map((skill, index) => {
      const name =
        (skill as unknown as { skillName?: string }).skillName ||
        skill.summary ||
        `Skill ${index + 1}`;
      const safeName = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
        .slice(0, 40);
      return {
        name,
        fileName: safeName ? `${safeName}.md` : `skill-${index + 1}.md`,
        content: skill.content,
      };
    });
  }

  private async writeSkills(
    workspaceDir: string,
    workspaceId: string,
    resetSkillsDir = false,
  ): Promise<void> {
    const skills = await this.getSkillFiles(workspaceId);
    const skillsDir = path.join(workspaceDir, 'skills');

    if (resetSkillsDir) {
      await fs.rm(skillsDir, { recursive: true, force: true });
    }

    if (skills.length === 0) {
      return;
    }

    await fs.mkdir(skillsDir, { recursive: true });

    await Promise.all(
      skills.map((skill) =>
        fs.writeFile(
          path.join(skillsDir, skill.fileName),
          skill.content,
          'utf8',
        ),
      ),
    );

    const index = skills
      .map((skill) => `- ${skill.name} (${skill.fileName})`)
      .join('\n');
    await fs.writeFile(
      path.join(skillsDir, 'SKILLS_INDEX.md'),
      `# Workspace Skills\n\n${index}\n`,
      'utf8',
    );
  }
}
