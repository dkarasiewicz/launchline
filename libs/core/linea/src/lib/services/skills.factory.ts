import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  blockerDetectionSkill,
  projectStatusSkill,
  teamAnalysisSkill,
  linearIntegrationSkill,
} from '../skills';

export interface SkillMetadata {
  name: string;
  description: string;
}

export interface SkillFile {
  path: string;
  content: string;
  metadata: SkillMetadata;
}

export interface FileData {
  content: string[];
  created_at: string;
  modified_at: string;
}

interface SkillDefinition {
  name: string;
  description: string;
  content: string;
}

/**
 * Skills Factory
 *
 * Manages skills for the Linea deep agent.
 * Skills are now imported as TypeScript objects for easier management.
 */
@Injectable()
export class SkillsFactory implements OnModuleInit {
  private readonly logger = new Logger(SkillsFactory.name);
  private skills: Map<string, SkillFile> = new Map();

  // All available skills
  private readonly skillDefinitions: SkillDefinition[] = [
    linearIntegrationSkill,
    teamAnalysisSkill,
    blockerDetectionSkill,
    projectStatusSkill,
  ];

  onModuleInit() {
    this.loadSkills();
  }

  /**
   * Load all skills from imported TypeScript objects
   */
  private loadSkills(): void {
    for (const skillDef of this.skillDefinitions) {
      this.skills.set(skillDef.name, {
        path: `/skills/${skillDef.name}/SKILL.md`,
        content: skillDef.content,
        metadata: {
          name: skillDef.name,
          description: skillDef.description,
        },
      });

      this.logger.log({ skill: skillDef.name }, 'Loaded skill');
    }

    this.logger.log({ count: this.skills.size }, 'Loaded skills');
  }

  /**
   * Get skill paths for deep agent configuration
   */
  getSkillPaths(): string[] {
    return ['/skills/'];
  }

  /**
   * Get skills as files for StateBackend
   * Returns Record<string, FileData> for use with deepagent invoke
   */
  getSkillFiles(): Record<string, FileData> {
    const files: Record<string, FileData> = {};
    const now = new Date().toISOString();

    for (const [, skill] of this.skills) {
      files[skill.path] = {
        content: skill.content.split('\n'),
        created_at: now,
        modified_at: now,
      };
    }

    return files;
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
