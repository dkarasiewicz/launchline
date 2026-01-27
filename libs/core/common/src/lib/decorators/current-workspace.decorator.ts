import {
  ContextType,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentWorkspace = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    let user;
    let workspaceId;

    if (context.getType<ContextType | 'graphql'>() === 'graphql') {
      const contextGql = GqlExecutionContext.create(context).getContext();

      user = contextGql.user;
      workspaceId = contextGql.currentWorkspaceId;
    } else {
      const request = context.switchToHttp().getRequest();

      user = request.user;
      workspaceId = request.session.currentWorkspaceId;
    }

    if (!user) {
      return null;
    }

    return workspaceId
      ? { id: workspaceId }
      : {
          id: user.primaryWorkspaceId,
        };
  },
);
