import {
  ContextType,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    let user;

    if (context.getType<ContextType | 'graphql'>() === 'graphql') {
      user = GqlExecutionContext.create(context).getContext().user;
    } else {
      user = context.switchToHttp().getRequest().user;
    }

    return user;
  },
);
