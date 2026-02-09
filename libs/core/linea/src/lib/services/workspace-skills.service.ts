import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import { StoreBackend, type FileData } from 'deepagents';
import { LINEA_STORE } from '../tokens';
import { MemoryService } from './memory.service';

export type WorkspaceSkill = {
  id: string;
  name: string;
  content: string;
  slug: string;
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class WorkspaceSkillsService {
  private readonly logger = new Logger(WorkspaceSkillsService.name);
  private readonly backfilledWorkspaces = new Set<string>();

  constructor(
    @Inject(LINEA_STORE)
    private readonly store: PostgresStore,
    private readonly memoryService: MemoryService,
  ) {}

  async listWorkspaceSkills(workspaceId: string): Promise<WorkspaceSkill[]> {
    await this.ensureBackfilled(workspaceId);
    const backend = this.createBackend(workspaceId);
    const entries = await backend.lsInfo('/');
    const skills: WorkspaceSkill[] = [];

    for (const entry of entries) {
      if (!entry.is_dir) {
        continue;
      }
      const dirPath = entry.path.replace(/\/$/, '');
      const slug = dirPath.replace(/^\//, '');
      const skillPath = `${dirPath}/SKILL.md`;

      try {
        const fileData = await backend.readRaw(skillPath);
        let content = fileData.content.join('\n');
        let metadata = this.parseSkillMarkdown(content);

        if (!metadata) {
          const normalizedName = this.normalizeSkillName(
            slug || 'workspace-skill',
          );
          const normalized = this.normalizeSkillContent(
            normalizedName,
            content,
          );
          const now = new Date().toISOString();
          const patched: FileData = {
            content: normalized.content.split('\n'),
            created_at: fileData.created_at || now,
            modified_at: now,
          };
          await this.writeSkillFile({
            workspaceId,
            filePath: skillPath,
            fileData: patched,
          });
          content = normalized.content;
          metadata = this.parseSkillMarkdown(content);
        }

        if (!metadata) {
          continue;
        }

        skills.push({
          id: slug || metadata.name,
          name: metadata.name,
          content,
          slug,
          createdAt: this.safeDate(fileData.created_at),
          updatedAt: this.safeDate(fileData.modified_at),
        });
      } catch {
        continue;
      }
    }

    return skills.sort((a, b) => {
      const aTime = (a.updatedAt ?? a.createdAt ?? new Date(0)).getTime();
      const bTime = (b.updatedAt ?? b.createdAt ?? new Date(0)).getTime();
      return bTime - aTime;
    });
  }

  async upsertWorkspaceSkill(
    workspaceId: string,
    name: string,
    content: string,
    options?: { id?: string },
  ): Promise<WorkspaceSkill> {
    const requestedId = options?.id ? this.slugify(options.id) : '';
    let normalizedName = this.normalizeSkillName(name);
    let slug = requestedId || this.slugify(normalizedName);
    if (!slug) {
      slug = `skill-${Date.now()}`;
      normalizedName = slug;
    }
    const normalized = this.normalizeSkillContent(normalizedName, content);
    const filePath = `/${slug}/SKILL.md`;
    const namespace = this.buildNamespace(workspaceId);
    const now = new Date().toISOString();

    let createdAt = now;
    try {
      const existing = await this.store.get(namespace, filePath);
      if (existing?.value && typeof existing.value === 'object') {
        const value = existing.value as FileData;
        if (typeof value.created_at === 'string') {
          createdAt = value.created_at;
        }
      }
    } catch (error) {
      this.logger.warn(
        { err: error, workspaceId, filePath },
        'Failed to read existing skill metadata',
      );
    }

    const fileData: FileData = {
      content: normalized.content.split('\n'),
      created_at: createdAt,
      modified_at: now,
    };

    await this.writeSkillFile({
      workspaceId,
      filePath,
      fileData,
    });

    return {
      id: slug,
      name: normalized.name,
      content: normalized.content,
      slug,
      createdAt: this.safeDate(createdAt),
      updatedAt: this.safeDate(now),
    };
  }

  async deleteWorkspaceSkill(
    workspaceId: string,
    id: string,
    options?: { userId?: string },
  ): Promise<boolean> {
    await this.ensureBackfilled(workspaceId);
    const slug = this.slugify(id);
    if (!slug) {
      return false;
    }

    const namespace = this.buildNamespace(workspaceId);
    const filePath = `/${slug}/SKILL.md`;
    let skillName: string | undefined;

    try {
      const existing = await this.store.get(namespace, filePath);
      if (!existing?.value) {
        return false;
      }
      const fileData = existing.value as FileData;
      const content = fileData.content?.join('\n') || '';
      const metadata = this.parseSkillMarkdown(content);
      skillName = metadata?.name;
    } catch (error) {
      this.logger.warn(
        { err: error, workspaceId, filePath },
        'Failed to read skill before deletion',
      );
    }

    await this.store.delete(namespace, filePath);
    if (options?.userId && skillName) {
      await this.archiveLegacySkillMemory(
        workspaceId,
        options.userId,
        skillName,
      );
    }

    return true;
  }

  private createBackend(workspaceId: string): StoreBackend {
    return new StoreBackend({
      store: this.store,
      state: {},
      assistantId: workspaceId,
    });
  }

  private buildNamespace(workspaceId: string): string[] {
    return [workspaceId, 'filesystem'];
  }

  private async ensureBackfilled(workspaceId: string): Promise<void> {
    if (this.backfilledWorkspaces.has(workspaceId)) {
      return;
    }

    this.backfilledWorkspaces.add(workspaceId);

    try {
      const memories = await this.memoryService.listMemories(
        workspaceId,
        'workspace',
        { limit: 200 },
      );
      const legacySkills = memories.filter(
        (memory) => memory.category === 'skill',
      );

      for (const memory of legacySkills) {
        const name =
          memory.summary?.replace(/^Sandbox workflow:\\s*/i, '') ||
          `skill-${memory.id}`;
        let normalizedName = this.normalizeSkillName(name);
        let slug = this.slugify(normalizedName);
        if (!slug) {
          slug = `skill-${memory.id}`;
          normalizedName = slug;
        }
        const normalized = this.normalizeSkillContent(
          normalizedName,
          memory.content || '',
        );
        const filePath = `/${slug}/SKILL.md`;
        const createdAt = this.safeDate(memory.createdAt)?.toISOString();
        const updatedAt = this.safeDate(memory.updatedAt)?.toISOString();
        const fileData: FileData = {
          content: normalized.content.split('\n'),
          created_at: createdAt ?? new Date().toISOString(),
          modified_at: updatedAt ?? new Date().toISOString(),
        };

        await this.writeSkillFile({
          workspaceId,
          filePath,
          fileData,
        });
      }
    } catch (error) {
      this.logger.warn(
        { err: error, workspaceId },
        'Failed to backfill workspace skills from memories',
      );
    }
  }

  private async archiveLegacySkillMemory(
    workspaceId: string,
    userId: string,
    skillName: string,
  ): Promise<void> {
    try {
      const memories = await this.memoryService.listMemories(
        workspaceId,
        'workspace',
        { limit: 200, includeArchived: true },
      );

      const target = skillName.trim().toLowerCase();

      for (const memory of memories) {
        if (memory.category !== 'skill') {
          continue;
        }
        const summary = memory.summary?.trim().toLowerCase();
        if (!summary) {
          continue;
        }
        if (summary === target || summary.endsWith(target)) {
          if (memory.archivedAt) {
            continue;
          }
          await this.memoryService.archiveMemory(
            {
              workspaceId,
              userId,
              correlationId: `skill-archive-${Date.now()}`,
            },
            memory.id,
            'workspace',
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        { err: error, workspaceId, skillName },
        'Failed to archive legacy skill memories',
      );
    }
  }

  private async writeSkillFile(input: {
    workspaceId: string;
    filePath: string;
    fileData: FileData;
  }): Promise<void> {
    const namespace = this.buildNamespace(input.workspaceId);
    await this.store.put(
      namespace,
      input.filePath,
      input.fileData as unknown as Record<string, string>,
    );
  }

  private normalizeSkillName(name: string): string {
    return this.slugify(name.trim());
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      .slice(0, 64);
  }

  private normalizeSkillContent(
    name: string,
    content: string,
  ): { name: string; content: string } {
    const normalized = content.replace(/\r\n/g, '\n');
    if (!normalized.startsWith('---\n')) {
      return {
        name,
        content: `---\nname: ${name}\ndescription: Workspace skill: ${name}\n---\n\n${normalized}`,
      };
    }

    const endIndex = normalized.indexOf('\n---\n');
    if (endIndex === -1) {
      return {
        name,
        content: `---\nname: ${name}\ndescription: Workspace skill: ${name}\n---\n\n${normalized}`,
      };
    }

    const frontmatter = normalized.slice(4, endIndex);
    const body = normalized.slice(endIndex + 5);
    const data: Record<string, string> = {};
    const extraLines: string[] = [];

    for (const line of frontmatter.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const separator = trimmed.indexOf(':');
      if (separator === -1) {
        extraLines.push(line);
        continue;
      }
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      value = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      data[key] = value;
      if (key !== 'name' && key !== 'description') {
        extraLines.push(line);
      }
    }

    const description = data['description'] || `Workspace skill: ${name}`;
    const rebuilt = [
      `name: ${name}`,
      `description: ${description}`,
      ...extraLines,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      name,
      content: `---\n${rebuilt}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`,
    };
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

  private safeDate(value?: string | Date): Date | undefined {
    if (!value) {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }
    return parsed;
  }
}
