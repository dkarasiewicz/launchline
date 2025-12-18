import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@launchline/models';

export interface WorkspaceDTO {
  id: string;
  name: string;
  deactivatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMemberDTO {
  id: string;
  userId: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  invitedAt?: Date;
  joinedAt?: Date;
  deactivatedAt?: Date;
}
