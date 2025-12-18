import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomBytes, randomUUID } from 'crypto';
import { PostHog } from 'posthog-node';
import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { addDays } from 'date-fns';
import {
  ANALYTICS_CLIENT,
  DB_CONNECTION,
  EventBusService,
  workspace,
  workspaceInvite,
  WorkspaceMemberInvitedEvent,
  WorkspaceMemberJoinedEvent,
  workspaceMembership,
} from '@launchline/core-common';
import {
  AnalyticsEventType,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from '@launchline/models';
import {
  CreateWorkspaceInvitationInput,
  RedeemWorkspaceInvitationInput,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
} from './workspace.models';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    @Inject(ANALYTICS_CLIENT) private readonly analyticsClient: PostHog,
    private readonly eventBusService: EventBusService,
  ) {}

  async getWorkspace(userId: string): Promise<Workspace> {
    const userWorkspaces = await this.db
      .select()
      .from(workspace)
      .innerJoin(
        workspaceMembership,
        eq(workspace.id, workspaceMembership.workspaceId),
      )
      .where(
        and(
          eq(workspaceMembership.userId, userId),
          isNull(workspaceMembership.deactivatedAt),
        ),
      );

    if (userWorkspaces.length !== 1) {
      this.logger.error(
        `Expected exactly one workspace for user, found ${userWorkspaces.length}`,
        { userId, workspacesNumber: userWorkspaces.length },
      );

      throw new NotFoundException('Workspace not found for user');
    }

    const userWorkspace = userWorkspaces[0].Workspace;

    return {
      id: userWorkspace.id,
      name: userWorkspace.name,
      deactivatedAt: userWorkspace.deactivatedAt ?? undefined,
      createdAt: userWorkspace.createdAt,
      updatedAt: userWorkspace.updatedAt,
      members: [],
    };
  }

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const workspaceMembers = await this.db
      .select()
      .from(workspaceMembership)
      .leftJoin(
        workspaceInvite,
        eq(workspaceMembership.id, workspaceInvite.workspaceMembershipId),
      )
      .where(
        and(
          eq(workspaceMembership.workspaceId, workspaceId),
          isNotNull(workspaceMembership.email),
        ),
      );

    return workspaceMembers.map((member) => this.mapToWorkspaceMember(member));
  }

  async createWorkspaceInvitation(
    userId: string,
    input: CreateWorkspaceInvitationInput,
  ): Promise<string> {
    const workspace = await this.getWorkspace(userId);

    const token = randomBytes(16).toString('hex');
    const now = new Date();

    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : addDays(now, 2);

    await this.db.transaction(async (tx) => {
      const newUserId = randomUUID();

      const membership = await tx
        .insert(workspaceMembership)
        .values({
          id: randomUUID(),
          createdAt: now,
          updatedAt: now,
          workspaceId: workspace.id,
          userId: newUserId,
          role: input.role || WorkspaceMemberRole.MEMBER,
          status: WorkspaceMemberStatus.INVITED,
          email: input.emailHint || null,
        })
        .returning();

      const invite = await tx
        .insert(workspaceInvite)
        .values({
          id: randomUUID(),
          createdAt: now,
          updatedAt: now,
          createdByUserId: userId,
          token,
          workspaceMembershipId: membership[0].id,
          expiresAt,
        })
        .returning();

      await this.eventBusService.publish(
        new WorkspaceMemberInvitedEvent(
          {
            workspaceId: workspace.id,
            userId: newUserId,
            email: input.emailHint,
            inviteId: invite[0].id,
            emittedAt: new Date().toISOString(),
          },
          userId,
        ),
      );

      this.analyticsClient.capture({
        distinctId: userId,
        event: AnalyticsEventType.WORKSPACE_INVITATION_SENT,
        properties: {
          userInvited: newUserId,
          workspaceId: workspace.id,
          role: input.role || WorkspaceMemberRole.MEMBER,
          emailHint: input.emailHint || null,
        },
      });
    });

    return token;
  }

  async getWorkspaceInvitation(token: string): Promise<WorkspaceInvitation> {
    const [invite] = await this.db
      .select()
      .from(workspaceInvite)
      .innerJoin(
        workspaceMembership,
        eq(workspaceInvite.workspaceMembershipId, workspaceMembership.id),
      )
      .innerJoin(workspace, eq(workspaceMembership.workspaceId, workspace.id))
      .where(eq(workspaceInvite.token, token));

    if (!invite) {
      this.logger.error(`Invitation not found for token: ${token}`, { token });

      throw new NotFoundException('Invitation not found');
    }

    if (invite.Workspace.deactivatedAt) {
      this.logger.error(
        `Invitation's workspace is deactivated for token: ${token}`,
        { token, workspaceId: invite.Workspace.id },
      );

      throw new BadRequestException('Invitation workspace is deactivated');
    }

    if (invite.WorkspaceMembership.deactivatedAt) {
      this.logger.error(
        `Invitation's workspace membership is inactive for token: ${token}`,
        { token, membershipId: invite.WorkspaceMembership.id },
      );

      throw new BadRequestException('Invitation membership is inactive');
    }

    if (invite.WorkspaceInvite.expiresAt < new Date()) {
      this.logger.error(`Invitation has expired for token: ${token}`, {
        token,
        expiresAt: invite.WorkspaceInvite.expiresAt,
      });

      throw new BadRequestException('Invitation has expired');
    }

    if (invite.WorkspaceInvite.disabledAt) {
      this.logger.error(`Invitation has been disabled for token: ${token}`, {
        token,
        disabledAt: invite.WorkspaceInvite.disabledAt,
      });

      throw new BadRequestException('Invitation has been disabled');
    }

    if (invite.WorkspaceInvite.consumedAt) {
      this.logger.error(
        `Invitation has already been consumed for token: ${token}`,
        {
          token,
          consumedAt: invite.WorkspaceInvite.consumedAt,
        },
      );

      throw new BadRequestException('Invitation has already been consumed');
    }

    return this.mapToWorkspaceInvitation(invite);
  }

  async redeemWorkspaceInvitation(
    input: RedeemWorkspaceInvitationInput,
  ): Promise<void> {
    const invite = await this.getWorkspaceInvitation(input.token);

    await this.db.transaction(async (tx) => {
      const [inviteRow] = await tx
        .select()
        .from(workspaceInvite)
        .where(eq(workspaceInvite.token, invite.token))
        .for('update');

      if (!inviteRow) {
        throw new NotFoundException('Invitation not found');
      }

      const now = new Date();

      await tx
        .update(workspaceInvite)
        .set({
          updatedAt: now,
          consumedAt: now,
        })
        .where(eq(workspaceInvite.id, inviteRow.id));

      const email = invite.emailHint || input.email;

      const membershipsWithTheSameEmail = await tx
        .select()
        .from(workspaceMembership)
        .where(
          and(
            eq(workspaceMembership.email, email),
            isNull(workspaceMembership.deactivatedAt),
            ne(workspaceMembership.status, WorkspaceMemberStatus.INVITED),
          ),
        )
        .limit(1);

      if (membershipsWithTheSameEmail.length) {
        this.logger.error(`Cannot redeem invitation, email already in use`, {
          email,
          workspaceId: invite.workspaceId,
        });

        throw new BadRequestException('Email is already in use ');
      }

      const [updatedMembership] = await tx
        .update(workspaceMembership)
        .set({
          status: WorkspaceMemberStatus.ACTIVE,
          fullName: input.fullName || undefined,
          email,
          updatedAt: now,
        })
        .where(eq(workspaceMembership.id, inviteRow.workspaceMembershipId))
        .returning();

      await this.eventBusService.publish(
        new WorkspaceMemberJoinedEvent({
          workspaceId: updatedMembership.workspaceId,
          userId: updatedMembership.userId,
          role: updatedMembership.role as WorkspaceMemberRole,
          email,
          fullName: input.fullName || undefined,
          joinedAt: now.toISOString(),
          emittedAt: new Date().toISOString(),
        }),
      );

      this.analyticsClient.capture({
        distinctId: updatedMembership.userId,
        event: AnalyticsEventType.WORKSPACE_MEMBER_JOINED,
        properties: {
          workspaceId: updatedMembership.workspaceId,
          email,
          fullName: input.fullName || undefined,
          $set: {
            workspaceId: updatedMembership.workspaceId,
          },
        },
      });
    });
  }

  private mapToWorkspaceMember({
    WorkspaceInvite,
    WorkspaceMembership,
  }: {
    WorkspaceMembership: typeof workspaceMembership.$inferSelect;
    WorkspaceInvite: typeof workspaceInvite.$inferSelect | null;
  }): WorkspaceMember {
    return {
      id: WorkspaceMembership.id,
      userId: WorkspaceMembership.userId,
      status: WorkspaceMembership.status as WorkspaceMemberStatus,
      fullName: WorkspaceMembership.fullName ?? undefined,
      email: WorkspaceMembership.email ?? undefined,
      role: WorkspaceMembership.role as WorkspaceMemberRole,
      invitedAt: WorkspaceInvite?.createdAt ?? undefined,
      joinedAt: WorkspaceInvite?.consumedAt ?? undefined,
      deactivatedAt: WorkspaceMembership.deactivatedAt ?? undefined,
    };
  }

  private mapToWorkspaceInvitation({
    Workspace,
    WorkspaceInvite,
    WorkspaceMembership,
  }: {
    Workspace: typeof workspace.$inferSelect;
    WorkspaceInvite: typeof workspaceInvite.$inferSelect;
    WorkspaceMembership: typeof workspaceMembership.$inferSelect;
  }): WorkspaceInvitation {
    return {
      token: WorkspaceInvite.token,
      workspaceId: Workspace.id,
      workspaceName: Workspace.name,
      role: WorkspaceMembership.role as WorkspaceMemberRole,
      emailHint: WorkspaceMembership.email ?? undefined,
      expiresAt: WorkspaceInvite.expiresAt,
    };
  }
}
