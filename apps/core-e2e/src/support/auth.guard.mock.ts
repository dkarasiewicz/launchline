import {
  CanActivate,
  ContextType,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthenticatedUser } from '@launchline/core-common';
import { UserRole } from '@launchline/models';
import { MainAuthGuard } from '@launchline/core-auth';

@Injectable()
export class MockMainAuthGuard extends MainAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = this.getRequest(context);
    const authHeader = req?.headers?.authorization || '';
    const token = authHeader.split(' ')[1]; // Format: 'Bearer userId role'
    const role =
      authHeader.split(' ')[2]?.toUpperCase() || UserRole.WORKSPACE_MEMBER;

    if (token) {
      const user: AuthenticatedUser = {
        userId: token,
        role,
        name: 'Test User',
        email: 'test@email.com',
        isVerified: true,
        isOnboarded: true,
      };

      if (req) {
        this.setUser(context, user);
      }
    }

    return super.canActivate(context);
  }

  private getRequest(context: ExecutionContext) {
    if (context.getType<ContextType | 'graphql'>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext().req;
    }

    return context.switchToHttp().getRequest();
  }

  private setUser(context: ExecutionContext, user: AuthenticatedUser) {
    if (context.getType<ContextType | 'graphql'>() === 'graphql') {
      GqlExecutionContext.create(context).getContext().user = user;
    } else {
      context.switchToHttp().getRequest().user = user;
    }
  }
}
