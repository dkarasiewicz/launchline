import { Query, Resolver } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '@launchline/core-common';
import { User } from './auth.models';
import { AuthService } from './auth.service';

@Resolver(() => User)
export class AuthResolver {
  private logger = new Logger(AuthResolver.name);

  constructor(private readonly authService: AuthService) {}

  @Query(() => User, { nullable: true })
  async getCurrentUserData(
    @CurrentUser() { userId }: AuthenticatedUser,
  ): Promise<User | null> {
    const userData = await this.authService.getUserAuthenticatedById(userId);

    if (!userData) {
      this.logger.error({ userId }, 'User not found');

      return null;
    }

    return {
      id: userData.userId,
      email: userData.email,
      name: userData.name,
      isVerified: userData.isVerified,
      role: userData.role,
      isOnboarded: userData.isOnboarded,
    };
  }
}
