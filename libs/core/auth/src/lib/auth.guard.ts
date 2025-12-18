import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ContextType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  AuthenticatedUser,
  ROLES_KEY,
} from '@launchline/core-common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '@launchline/models';

@Injectable()
export class MainAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const user = this.getUser(context);

    if (!user) {
      return false;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    return requiredRoles.some((role) => user.role === role);
  }

  private getUser(context: ExecutionContext): AuthenticatedUser | undefined {
    if (context.getType<ContextType | 'graphql'>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext().user;
    }

    return context.switchToHttp().getRequest().user;
  }
}
