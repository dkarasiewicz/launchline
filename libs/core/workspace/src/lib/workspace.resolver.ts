import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';

import {
  AuthenticatedUser,
  CurrentUser,
  Public,
  Roles,
} from '@launchline/core-common';
import { WorkspaceService } from './workspace.service';

import {
  CreateWorkspaceInput,
  CreateWorkspaceInvitationInput,
  CreateWorkspaceResult,
  GetWorkspaceInvitationInput,
  RedeemWorkspaceInvitationInput,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
} from './workspace.models';
import { UserRole } from '@launchline/models';

@Resolver(() => Workspace)
export class WorkspaceResolver {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Roles(UserRole.WORKSPACE_ADMIN)
  @Query(() => Workspace)
  async getWorkspace(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Workspace> {
    return this.workspaceService.getWorkspace(user.userId);
  }

  @ResolveField(() => [WorkspaceMember])
  async members(@Parent() workspace: Workspace): Promise<WorkspaceMember[]> {
    return await this.workspaceService.getWorkspaceMembers(workspace.id);
  }

  @Roles(UserRole.WORKSPACE_ADMIN)
  @Mutation(() => String)
  async inviteWorkspaceMember(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: CreateWorkspaceInvitationInput,
  ): Promise<string> {
    return this.workspaceService.createWorkspaceInvitation(user.userId, input);
  }

  @Public()
  @Query(() => WorkspaceInvitation)
  async getInvite(
    @Args('input') input: GetWorkspaceInvitationInput,
  ): Promise<WorkspaceInvitation> {
    return this.workspaceService.getWorkspaceInvitation(input.token);
  }

  @Public()
  @Mutation(() => Boolean)
  async redeemInvite(
    @Args('input') input: RedeemWorkspaceInvitationInput,
  ): Promise<boolean> {
    await this.workspaceService.redeemWorkspaceInvitation(input);

    return true;
  }

  // @Roles(UserRole.ADMIN)
  @Public()
  @Mutation(() => CreateWorkspaceResult)
  async createWorkspace(
    @Args('input') input: CreateWorkspaceInput,
  ): Promise<CreateWorkspaceResult> {
    return this.workspaceService.createWorkspace(input);
  }
}
