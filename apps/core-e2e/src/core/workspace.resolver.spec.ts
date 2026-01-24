import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { MockConfigModule } from '../support/config.module.mock';
import { MockCommonModule } from '../support/common.module.mock';
import {
  DB_CONNECTION,
  workspace,
  workspaceMembership,
  user,
} from '@launchline/core-common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { MockDbModule } from '../support/db.module.mock';
import { MockRedisModule } from '../support/redis.module.mock';
import { MockEventBusModule } from '../support/eventbus.module.mock';
import { randomUUID } from 'node:crypto';
import { MainAuthGuard } from '@launchline/core-auth';
import { MockMainAuthGuard } from '../support/auth.guard.mock';
import {
  UserRole,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from '@launchline/models';
import { MockAnalyticsModule } from '../support/analytics.module.mock';
import { WorkspaceModule } from '@launchline/core-workspace';
import { EventBusService } from '@launchline/core-common';

describe('WorkspaceResolver (integration)', () => {
  let app: INestApplication;
  let db: NodePgDatabase & { $client: Pool };
  let dbUser: typeof user.$inferSelect;
  let dbWorkspace: typeof workspace.$inferSelect;
  let dbMembership: typeof workspaceMembership.$inferSelect;
  let eventBus: EventBusService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          subscriptions: {
            'graphql-ws': true,
          },
        }),
        WorkspaceModule,
        MockCommonModule,
        MockConfigModule,
        MockDbModule,
        MockRedisModule,
        MockEventBusModule,
        MockAnalyticsModule,
      ],
    })
      .overrideProvider(MainAuthGuard)
      .useClass(MockMainAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    db = app.get(DB_CONNECTION);
    eventBus = app.get(EventBusService);

    await app.init();
  });

  beforeEach(async () => {
    [dbUser] = await db
      .insert(user)
      .values({
        id: randomUUID(),
        updatedAt: new Date(),
        email: 'workspace-admin@example.com',
        role: UserRole.WORKSPACE_ADMIN,
        createdAt: new Date(),
      })
      .returning();

    [dbWorkspace] = await db
      .insert(workspace)
      .values({
        id: randomUUID(),
        name: 'Test Workspace',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    [dbMembership] = await db
      .insert(workspaceMembership)
      .values({
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceId: dbWorkspace.id,
        userId: dbUser.id,
        role: WorkspaceMemberRole.ADMIN,
        status: WorkspaceMemberStatus.ACTIVE,
        email: dbUser.email,
      })
      .returning();
  });

  afterEach(async () => {
    jest.clearAllMocks();

    await db.$client.query('TRUNCATE TABLE "WorkspaceInvite" CASCADE;');
    await db.$client.query('TRUNCATE TABLE "WorkspaceMembership" CASCADE;');
    await db.$client.query('TRUNCATE TABLE "Workspace" CASCADE;');
    await db.$client.query('TRUNCATE TABLE "User" CASCADE;');
  });

  afterAll(async () => {
    await db.$client.end();
    await app.close();
  });

  describe('getWorkspace', () => {
    it("returns the authenticated user's workspace", async () => {
      const query = `
        query Workspace {
          getWorkspace {
            id
            name
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${dbUser.id} ${UserRole.WORKSPACE_ADMIN}`)
        .send({ query });

      expect(res.status).toBe(200);
      expect(res.body.data.getWorkspace).toEqual({
        id: dbWorkspace.id,
        name: dbWorkspace.name,
      });
    });
  });

  describe('members field', () => {
    it('returns members for a workspace', async () => {
      const query = `
        query WorkspaceWithMembers {
          getWorkspace {
            id
            members {
              id
              userId
              status
              role
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${dbUser.id} ${UserRole.WORKSPACE_ADMIN}`)
        .send({ query });

      expect(res.status).toBe(200);
      expect(res.body.data.getWorkspace.members).toEqual([
        {
          id: dbMembership.id,
          userId: dbUser.id,
          status: WorkspaceMemberStatus.ACTIVE,
          role: WorkspaceMemberRole.ADMIN,
        },
      ]);
    });
  });

  describe('inviteWorkspaceMember', () => {
    it('creates an invitation and returns token', async () => {
      const mutation = `
        mutation InviteWorkspaceMember($input: CreateWorkspaceInvitationInput!) {
          inviteWorkspaceMember(input: $input)
        }
      `;

      const variables = {
        input: {
          workspaceId: dbWorkspace.id,
          role: WorkspaceMemberRole.MEMBER,
          emailHint: 'invitee@example.com',
        },
      };

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${dbUser.id} ${UserRole.WORKSPACE_ADMIN}`)
        .send({ query: mutation, variables });

      expect(res.status).toBe(200);
      expect(res.body.data.inviteWorkspaceMember).toBeDefined();

      const query = `
        query WorkspaceWithMembers {
          getWorkspace {
            id
            members {
              id
              userId
              status
              role
            }
          }
        }
      `;

      const workspaceMembersRes = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${dbUser.id} ${UserRole.WORKSPACE_ADMIN}`)
        .send({ query });

      expect(workspaceMembersRes.status).toBe(200);

      const members = workspaceMembersRes.body.data.getWorkspace.members;
      const invitedMember = members.find(
        (member: {
          status: WorkspaceMemberStatus;
          role: WorkspaceMemberRole;
        }) => member.status === WorkspaceMemberStatus.INVITED,
      );

      expect(invitedMember).toBeDefined();
      expect(invitedMember.role).toBe(WorkspaceMemberRole.MEMBER);
    });
  });

  describe('getInvite', () => {
    it('returns invitation by token', async () => {
      const mutation = `
        mutation InviteWorkspaceMember($input: CreateWorkspaceInvitationInput!) {
          inviteWorkspaceMember(input: $input)
        }
      `;

      const createInviteRes = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${dbUser.id} ${UserRole.WORKSPACE_ADMIN}`)
        .send({
          query: mutation,
          variables: {
            input: {
              workspaceId: dbWorkspace.id,
              role: WorkspaceMemberRole.MEMBER,
              emailHint: 'invitee@example.com',
            },
          },
        });

      const query = `
        query GetInvite($input: GetWorkspaceInvitationInput!) {
          getInvite(input: $input) {
            token
            workspaceId
            workspaceName
            role
            emailHint
            expiresAt
          }
        }
      `;

      const variables = {
        input: { token: createInviteRes.body.data.inviteWorkspaceMember },
      };

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query, variables });

      expect(res.status).toBe(200);
      expect(res.body.data.getInvite.workspaceId).toBe(dbWorkspace.id);
      expect(res.body.data.getInvite.workspaceName).toBe(dbWorkspace.name);
      expect(res.body.data.getInvite.role).toBe(WorkspaceMemberRole.MEMBER);
      expect(res.body.data.getInvite.emailHint).toBe('invitee@example.com');
    });
  });

  describe('redeemInvite', () => {
    it('redeems invite, activates membership and publishes event', async () => {
      const createInviteRes = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${dbUser.id} ${UserRole.WORKSPACE_ADMIN}`)
        .send({
          query: `
            mutation InviteWorkspaceMember($input: CreateWorkspaceInvitationInput!) {
              inviteWorkspaceMember(input: $input)
            }
          `,
          variables: {
            input: {
              workspaceId: dbWorkspace.id,
              role: WorkspaceMemberRole.MEMBER,
              emailHint: 'invitee@example.com',
            },
          },
        });

      const publishSpy = jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const mutation = `
        mutation RedeemInvite($input: RedeemWorkspaceInvitationInput!) {
          redeemInvite(input: $input)
        }
      `;

      const variables = {
        input: {
          token: createInviteRes.body.data.inviteWorkspaceMember,
          email: 'invitee@example.com',
          fullName: 'Invited User',
        },
      };

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: mutation, variables });

      expect(res.status).toBe(200);
      expect(res.body.data.redeemInvite).toBe(true);

      const workspaceRes = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${dbUser.id} ${UserRole.WORKSPACE_ADMIN}`)
        .send({
          query: `
            query WorkspaceWithMembers {
              getWorkspace {
                id
                members {
                  id
                  userId
                  status
                  role
                  email
                }
              }
            }
          `,
        });

      const members = workspaceRes.body.data.getWorkspace.members;
      const redeemedMember = members.find(
        (member: { email: string }) => member.email === 'invitee@example.com',
      );

      expect(redeemedMember).toBeDefined();
      expect(redeemedMember.status).toBe(WorkspaceMemberStatus.ACTIVE);

      const query = `
        query GetInvite($input: GetWorkspaceInvitationInput!) {
          getInvite(input: $input) {
            token
            workspaceId
            workspaceName
            role
            emailHint
            expiresAt
          }
        }
      `;

      const redeemedInviteRes = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query,
          variables: {
            input: { token: createInviteRes.body.data.inviteWorkspaceMember },
          },
        });

      expect(redeemedInviteRes.status).toBe(200);
      expect(redeemedInviteRes.body.data).toBeNull();

      expect(publishSpy).toHaveBeenCalledWith({
        eventType: 'WORKSPACE_MEMBER_JOINED',
        id: expect.any(String),
        origin: 'WORKSPACE',
        payload: {
          email: 'invitee@example.com',
          emittedAt: expect.any(String),
          fullName: 'Invited User',
          joinedAt: expect.any(String),
          phoneNumber: undefined,
          role: 'MEMBER',
          workspaceId: dbWorkspace.id,
          userId: expect.any(String),
        },
        userId: undefined,
        version: 'V1',
      });
    });
  });
});
