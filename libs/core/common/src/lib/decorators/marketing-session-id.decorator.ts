import {
  ContextType,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const MarketingSessionId = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    let sessionId: string | undefined = undefined;

    if (context.getType<ContextType | 'graphql'>() === 'graphql') {
      sessionId = GqlExecutionContext.create(context).getContext().marketingId;
    }

    return sessionId;
  },
);
