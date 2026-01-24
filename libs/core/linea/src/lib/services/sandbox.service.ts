import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MemoryService } from './memory.service';
import type { MemoryItem } from '../types';

export type SandboxRunResult = {
  output: string;
  exitCode: number | null;
  durationMs: number;
  truncated: boolean;
  containerId?: string;
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
      socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    });
    this.image =
      this.configService.get<string>('linea.sandbox.image') ||
      process.env.LINEA_SANDBOX_IMAGE ||
      'mcr.microsoft.com/playwright:v1.50.0-jammy';
    this.outputLimit = Number(
      process.env.LINEA_SANDBOX_OUTPUT_LIMIT || '12000',
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
      const skills = await this.getSkillFiles(input.workspaceId);

      if (skills.length > 0) {
        const skillsDir = path.join(tempDir, 'skills');
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
          NetworkMode: process.env.LINEA_SANDBOX_NETWORK || 'bridge',
          Binds: binds,
          Memory: Number(process.env.LINEA_SANDBOX_MEMORY || 536870912),
          CpuShares: Number(process.env.LINEA_SANDBOX_CPU_SHARES || 512),
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

  private async ensureImage(image: string): Promise<void> {
    const images = await this.docker.listImages({ filters: { reference: [image] } });
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

  private async getSkillFiles(
    workspaceId: string,
  ): Promise<Array<{ name: string; fileName: string; content: string }>> {
    const memories = await this.memoryService.listMemories(
      workspaceId,
      'workspace',
      { limit: 50 },
    );

    const skills = memories.filter(
      (memory) => memory.category === 'skill',
    );

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
}
