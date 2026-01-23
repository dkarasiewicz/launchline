import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule, MainAuthGuard } from '@launchline/core-auth';
import request from 'supertest';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { MockConfigModule } from '../support/config.module.mock';
import { MockCommonModule } from '../support/common.module.mock';
import { DB_CONNECTION, user, otp } from '@launchline/core-common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { MockDbModule } from '../support/db.module.mock';
import { MockRedisModule } from '../support/redis.module.mock';
import { MockEventBusModule } from '../support/eventbus.module.mock';
import { randomUUID } from 'node:crypto';
import session from 'express-session';
import passport from 'passport';
import { MockMainAuthGuard } from '../support/auth.guard.mock';
import { UserRole } from '@launchline/models';
import { MockAnalyticsModule } from '../support/analytics.module.mock';

describe('AuthController (integration)', () => {
  const emailForOtp = 'email-otp@example.com';
  let app: INestApplication;
  let db: NodePgDatabase & { $client: Pool };
  let verifiedUser: typeof user.$inferSelect;
  let unverifiedUser: typeof user.$inferSelect;
  let otpCode: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AuthModule,
        MockDbModule,
        MockRedisModule,
        MockConfigModule,
        MockCommonModule,
        MockEventBusModule,
        MockAnalyticsModule,
      ],
    })
      .overrideProvider(MainAuthGuard)
      .useValue(MockMainAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();

    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
      }),
    );
    app.use(passport.session());

    db = app.get(DB_CONNECTION);

    await app.init();
  });

  beforeEach(async () => {
    otpCode = '123456';

    // Create verified user
    [verifiedUser] = await db
      .insert(user)
      .values({
        id: randomUUID(),
        updatedAt: new Date(),
        email: 'verified@example.com',
        role: UserRole.WORKSPACE_MEMBER,
        createdAt: new Date(),
        isEmailVerified: true,
      })
      .returning();

    // Create unverified user for OTP verification flow
    [unverifiedUser] = await db
      .insert(user)
      .values({
        id: randomUUID(),
        updatedAt: new Date(),
        email: 'unverified@example.com',
        role: UserRole.WORKSPACE_MEMBER,
        createdAt: new Date(),
        isEmailVerified: false,
      })
      .returning();
  });

  afterEach(async () => {
    jest.clearAllMocks();

    await db.$client.query('TRUNCATE TABLE "Otp" CASCADE;');
    await db.$client.query('TRUNCATE TABLE "User" CASCADE;');
  });

  afterAll(async () => {
    await db.$client.end();
    await app.close();
  });

  describe('sendOtp', () => {
    it('should send OTP successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login/otp/send')
        .send({
          email: unverifiedUser.email,
        });

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toEqual({ success: true });

      const otps = await db
        .select()
        .from(otp)
        .where(eq(otp.identifier, unverifiedUser.email));

      expect(otps).toHaveLength(1);
    });

    it('should not send OTP to a non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login/otp/send')
        .send({
          email: 'newuser@example.com',
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP and update an unverified user', async () => {
      await request(app.getHttpServer()).post('/auth/login/otp/send').send({
        email: unverifiedUser.email,
      });

      const otpAttempt = await db
        .select()
        .from(otp)
        .where(eq(otp.identifier, unverifiedUser.email))
        .limit(1);

      const response = await request(app.getHttpServer())
        .post('/auth/login/otp/verify')
        .send({
          email: unverifiedUser.email,
          code: otpAttempt[0].code,
        });

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toHaveProperty('userId', unverifiedUser.id);
      expect(response.body).toHaveProperty('role', UserRole.WORKSPACE_MEMBER);

      const [updatedUser] = await db
        .select()
        .from(user)
        .where(eq(user.id, unverifiedUser.id));

      expect(updatedUser.isEmailVerified).toBe(true);
    });

    it('should reject invalid OTP code', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login/otp/verify')
        .send({
          email: unverifiedUser.email,
          code: 'wrong-code',
        });

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should reject expired OTP', async () => {
      const expiredEmail = 'expired@example.com';

      await db.insert(user).values({
        id: randomUUID(),
        email: expiredEmail,
        role: UserRole.WORKSPACE_MEMBER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(otp).values({
        id: randomUUID(),
        identifier: expiredEmail,
        code: otpCode,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        updatedAt: new Date(),
      } satisfies typeof otp.$inferInsert);

      const response = await request(app.getHttpServer())
        .post('/auth/login/otp/verify')
        .send({
          email: expiredEmail,
          code: otpCode,
        });

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 when user does not exist', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login/otp/verify')
        .send({
          email: emailForOtp,
          code: otpCode,
        });

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 when OTP does not exist for user', async () => {
      const userWithoutOtp = 'no-otp@example.com';
      await db.insert(user).values({
        id: randomUUID(),
        email: userWithoutOtp,
        role: UserRole.WORKSPACE_MEMBER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login/otp/verify')
        .send({
          email: userWithoutOtp,
          code: otpCode,
        });

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('currentUser', () => {
    it('should return the current authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${verifiedUser.id}`);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toHaveProperty('userId', verifiedUser.id);
      expect(response.body).toHaveProperty('role', UserRole.WORKSPACE_MEMBER);
    });
  });
});
