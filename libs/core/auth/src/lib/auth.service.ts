import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ANALYTICS_CLIENT,
  AuthenticatedUser,
  AuthUserCreatedEvent,
  DB_CONNECTION,
  EventBusService,
  otp,
  user,
  UserDTO,
  UserIdentifierType,
} from '@launchline/core-common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { and, desc, eq, gt } from 'drizzle-orm';
import { AnalyticsEventType, UserRole } from '@launchline/models';
import { addMinutes, subDays } from 'date-fns';
import { PostHog } from 'posthog-node';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    @Inject(ANALYTICS_CLIENT) private readonly analyticsClient: PostHog,
    private readonly eventBusService: EventBusService,
  ) {}

  async getUserDTOById(userId: string): Promise<UserDTO | null> {
    const [userRecord] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, userId));

    if (!userRecord) {
      return null;
    }

    return {
      customerEmail: userRecord.email,
      name: userRecord.fullName,
      role: userRecord.role as UserRole,
      id: userRecord.id,
      primaryWorkspaceId: userRecord.primaryWorkspaceId,
    };
  }

  async getUserAuthenticatedById(
    userId: string,
  ): Promise<AuthenticatedUser | null> {
    const [userRecord] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, userId));

    if (!userRecord) {
      return null;
    }

    return this.mapUserToAuthenticatedUser(userRecord);
  }

  async sendEmailOtp(email: string): Promise<boolean> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = addMinutes(new Date(), 10);

    try {
      const [existingUser] = await this.db
        .select()
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      if (!existingUser) {
        this.logger.debug('User for email not found, it needs to exist first', {
          email,
        });

        return false;
      }

      await this.db.transaction(async (tx) => {
        await tx
          .update(otp)
          .set({ expiresAt: subDays(new Date(), 1), updatedAt: new Date() })
          .where(
            and(
              eq(otp.identifier, email),
              eq(otp.isVerified, false),
              gt(otp.expiresAt, new Date()),
            ),
          );

        await tx.insert(otp).values({
          id: randomUUID(),
          code,
          identifier: email,
          userId: existingUser.id,
          expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
          isVerified: false,
          attemptCount: 0,
        });

        this.analyticsClient.capture({
          distinctId: existingUser.id,
          event: AnalyticsEventType.USER_LOGIN_ATTEMPT,
          properties: {
            email,
            code,
            method: 'email_otp',
          },
        });
      });

      this.logger.debug(`Email OTP sent to ${email}`, {
        userId: existingUser.id,
        email,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to send email OTP`, {
        email,
        error,
      });

      return false;
    }
  }

  async verifyEmailOtp(
    email: string,
    code: string,
  ): Promise<AuthenticatedUser | null> {
    try {
      const [otpRecord] = await this.db
        .select()
        .from(otp)
        .where(
          and(
            eq(otp.identifier, email),
            eq(otp.isVerified, false),
            gt(otp.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(otp.createdAt))
        .limit(1);

      if (!otpRecord) {
        this.logger.debug(`No valid email OTP found for ${email}`, {
          email,
        });

        return null;
      }

      return await this.db.transaction(async (tx) => {
        const [updatedOtpRecord] = await tx
          .update(otp)
          .set({
            attemptCount: otpRecord.attemptCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(otp.id, otpRecord.id))
          .returning();

        if (updatedOtpRecord.attemptCount > 3) {
          this.logger.debug(`Max email OTP attempts exceeded for ${email}`, {
            email,
          });

          return null;
        }

        if (updatedOtpRecord.code !== code) {
          this.logger.debug(`Invalid email OTP for ${email}`, {
            email,
          });

          return null;
        }

        if (!updatedOtpRecord.userId) {
          this.logger.debug(
            `OTP record does not have associated user for ${email}`,
            {
              email,
            },
          );

          return null;
        }

        await tx
          .update(otp)
          .set({ isVerified: true, updatedAt: new Date() })
          .where(eq(otp.id, otpRecord.id));

        const [existingUser] = await tx
          .select()
          .from(user)
          .where(eq(user.id, updatedOtpRecord.userId))
          .limit(1);

        if (!existingUser) {
          this.logger.debug(
            'User for email not found, it needs to exist first',
            {
              email,
            },
          );

          return null;
        }

        if (existingUser.isEmailVerified) {
          return this.mapUserToAuthenticatedUser(existingUser);
        }

        await tx
          .update(user)
          .set({
            isEmailVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(user.id, existingUser.id));

        await this.eventBusService.publish(
          new AuthUserCreatedEvent(
            {
              userId: existingUser.id,
              identifierType: UserIdentifierType.EMAIL,
              emittedAt: new Date().toISOString(),
              email,
            },
            existingUser.id,
          ),
        );

        return this.mapUserToAuthenticatedUser(existingUser);
      });
    } catch (error) {
      this.logger.error(`Email OTP verification failed`, {
        email,
        error,
      });

      return null;
    }
  }

  async createUnverifiedUserWithEmail(
    userId: string,
    email: string,
    role: UserRole,
    primaryWorkspaceId: string,
    fullName?: string,
  ): Promise<UserDTO> {
    return this.db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        email,
        fullName,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        primaryWorkspaceId,
        role,
      });

      await this.sendEmailOtp(email);

      return {
        customerEmail: email,
        customerPhone: null,
        name: fullName || null,
        merchantId: null,
        role,
        id: userId,
        primaryWorkspaceId,
      };
    });
  }

  mapUserToAuthenticatedUser(
    userData: typeof user.$inferSelect,
  ): AuthenticatedUser {
    return {
      userId: userData.id,
      role: userData.role as UserRole,
      email: userData.email,
      name: userData.fullName,
      isVerified: userData.isEmailVerified || false,
      isOnboarded: userData.isOnboardingComplete || false,
      primaryWorkspaceId: userData.primaryWorkspaceId,
    };
  }
}
