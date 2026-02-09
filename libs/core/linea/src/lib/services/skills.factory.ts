import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import type { FileData } from 'deepagents';
import fs from 'node:fs';
import path from 'node:path';
import { LINEA_STORE } from '../tokens';

export type { FileData } from 'deepagents';

export interface SkillMetadata {
  name: string;
  description: string;
}

export interface SkillFile {
  path: string;
  content: string;
  metadata: SkillMetadata;
}

/**
 * Skills Factory
 *
 * Manages core skills for the Linea deep agent and seeds them per workspace.
 */
@Injectable()
export class SkillsFactory implements OnModuleInit {
  private readonly logger = new Logger(SkillsFactory.name);
  private readonly skills: Map<string, SkillFile> = new Map();
  private readonly seededWorkspaces = new Set<string>();
  private readonly seedingWorkspaces = new Map<string, Promise<void>>();

  constructor(
    @Inject(LINEA_STORE)
    private readonly store: PostgresStore,
  ) {}

  onModuleInit() {
    this.loadSkills();
  }

  async ensureWorkspaceSkills(workspaceId: string): Promise<void> {
    if (!workspaceId) {
      return;
    }
    if (this.seededWorkspaces.has(workspaceId)) {
      return;
    }
    const existing = this.seedingWorkspaces.get(workspaceId);
    if (existing) {
      await existing;
      return;
    }

    const task = this.seedWorkspaceSkills(workspaceId);
    this.seedingWorkspaces.set(workspaceId, task);
    try {
      await task;
      this.seededWorkspaces.add(workspaceId);
    } catch (error) {
      this.logger.warn(
        { err: error, workspaceId },
        'Failed to seed workspace skills',
      );
    } finally {
      this.seedingWorkspaces.delete(workspaceId);
    }
  }

  /**
   * Seed core skills into the workspace store if they are missing.
   */
  private async seedWorkspaceSkills(workspaceId: string): Promise<void> {
    if (this.skills.size === 0) {
      this.logger.warn('No core skills loaded; skipping workspace seeding');
      return;
    }

    const now = new Date().toISOString();
    const namespace = this.buildWorkspaceNamespace(workspaceId);
    const seedNamespace = this.buildSeedNamespace(workspaceId);
    try {
      const existingSeed = await this.store.get(seedNamespace, 'skills_seeded');
      if (existingSeed?.value) {
        return;
      }
    } catch (error) {
      this.logger.debug(
        { err: error, workspaceId },
        'Failed to read workspace seed marker',
      );
    }

    let seededCount = 0;

    for (const skill of this.skills.values()) {
      const filePath = skill.path;
      let exists = false;

      try {
        const existing = await this.store.get(namespace, filePath);
        exists = Boolean(existing?.value);
      } catch (error) {
        this.logger.debug(
          { err: error, workspaceId, filePath },
          'Failed to read skill before seeding',
        );
      }

      if (exists) {
        continue;
      }

      const fileData = this.createFileData(skill.content, now);
      await this.store.put(
        namespace,
        filePath,
        fileData as unknown as Record<string, string>,
      );
      seededCount += 1;
    }

    await this.store.put(seedNamespace, 'skills_seeded', {
      seededAt: now,
      skillCount: this.skills.size,
      addedCount: seededCount,
    } as unknown as Record<string, string>);

    this.logger.log(
      { workspaceId, seededCount },
      'Seeded core skills for workspace',
    );
  }

  private createFileData(content: string, now: string): FileData {
    return {
      content: content.split('\n'),
      created_at: now,
      modified_at: now,
    };
  }

  private buildWorkspaceNamespace(workspaceId: string): string[] {
    return [workspaceId, 'filesystem'];
  }

  private buildSeedNamespace(workspaceId: string): string[] {
    return [workspaceId, 'settings'];
  }

  /**
   * Load all skills from SKILL.md files on disk
   */
  private loadSkills(): void {
    const diskSkills = this.loadSkillsFromDisk();
    if (diskSkills.length === 0) {
      this.logger.warn('No skills found on disk');
      return;
    }

    for (const skill of diskSkills) {
      this.skills.set(skill.metadata.name, skill);
      this.logger.log({ skill: skill.metadata.name }, 'Loaded skill from disk');
    }

    this.logger.log({ count: this.skills.size }, 'Loaded skills');
  }

  private loadSkillsFromDisk(): SkillFile[] {
    const skillFilesByName = new Map<string, SkillFile>();

    for (const skillsDir of this.getSkillsDirectories()) {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const skillDir = path.join(skillsDir, entry.name);
        const skillPath = path.join(skillDir, 'SKILL.md');
        if (!fs.existsSync(skillPath)) {
          continue;
        }

        try {
          const raw = fs.readFileSync(skillPath, 'utf8');
          const parsed = this.parseSkillMarkdown(raw);
          if (!parsed) {
            this.logger.warn(
              { skillPath },
              'Skipping skill with invalid frontmatter',
            );
            continue;
          }

          const safeName = this.slugify(parsed.name) || entry.name;
          skillFilesByName.set(parsed.name, {
            path: `/${safeName}/SKILL.md`,
            content: raw,
            metadata: {
              name: parsed.name,
              description: parsed.description,
            },
          });
        } catch (error) {
          this.logger.warn(
            { err: error, skillPath },
            'Failed to read skill from disk',
          );
        }
      }
    }

    return Array.from(skillFilesByName.values());
  }

  private getSkillsDirectories(): string[] {
    const candidates = [
      path.resolve(__dirname, '..', 'skills'),
      path.resolve(
        process.cwd(),
        'libs',
        'core',
        'linea',
        'src',
        'lib',
        'skills',
      ),
      path.resolve(
        process.cwd(),
        'dist',
        'libs',
        'core',
        'linea',
        'src',
        'lib',
        'skills',
      ),
    ];

    return candidates.filter((dir) => fs.existsSync(dir));
  }

  private parseSkillMarkdown(
    raw: string,
  ): { name: string; description: string } | null {
    const normalized = raw.replace(/\r\n/g, '\n');
    if (!normalized.startsWith('---\n')) {
      return null;
    }

    const endIndex = normalized.indexOf('\n---\n');
    if (endIndex === -1) {
      return null;
    }

    const frontmatter = normalized.slice(4, endIndex);
    const data: Record<string, string> = {};
    for (const line of frontmatter.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const separator = trimmed.indexOf(':');
      if (separator === -1) {
        continue;
      }
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      value = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      data[key] = value;
    }

    if (!data['name'] || !data['description']) {
      return null;
    }

    return { name: data['name'], description: data['description'] };
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      .slice(0, 64);
  }

  /**
   * Get skill paths for deep agent configuration
   */
  getSkillPaths(): string[] {
    return ['/skills/'];
  }

  /**
   * Get skill summaries for agent context
   */
  getSkillSummaries(): string {
    if (this.skills.size === 0) {
      return 'No skills loaded.';
    }

    const summaries = Array.from(this.skills.values())
      .map(
        (skill) =>
          `- **${skill.metadata.name}**: ${skill.metadata.description}`,
      )
      .join('\n');

    return `## Available Skills\n\n${summaries}\n\nUse these skills when relevant to the user's request.`;
  }

  /**
   * Get a specific skill by name
   */
  getSkill(name: string): SkillFile | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all loaded skills
   */
  getAllSkills(): SkillFile[] {
    return Array.from(this.skills.values());
  }
}
