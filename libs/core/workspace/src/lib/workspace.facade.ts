import { Injectable, Logger } from '@nestjs/common';

import { WorkspaceService } from './workspace.service';
import { WorkspaceDTO, WorkspaceMemberDTO } from '@launchline/core-common';
import { WorkspaceMemberStatus } from '@launchline/models';

@Injectable()
export class WorkspaceFacade {
  private logger = new Logger(WorkspaceFacade.name);

  constructor(private readonly workspaceService: WorkspaceService) {}

  async getWorkspaceByUserId(userId: string): Promise<WorkspaceDTO> {
    this.logger.debug(`Fetching workspace for user: ${userId}`);

    const workspace = await this.workspaceService.getWorkspace(userId);

    return {
      id: workspace.id,
      name: workspace.name,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      deactivatedAt: workspace.deactivatedAt,
    };
  }

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberDTO[]> {
    this.logger.debug(`Fetching workspace members for workspace: ${workspaceId}`);

    const members = await this.workspaceService.getWorkspaceMembers(workspaceId);

    return members
      .filter(
        (member) => member.userId && member.status === WorkspaceMemberStatus.ACTIVE,
      )
      .map((member) => ({
        id: member.id,
        userId: member.userId as string,
        role: member.role,
        status: member.status,
        invitedAt: member.invitedAt,
        joinedAt: member.joinedAt,
        deactivatedAt: member.deactivatedAt,
      }));
  }
}
