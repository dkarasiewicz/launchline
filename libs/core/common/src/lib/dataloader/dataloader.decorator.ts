import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
  Type,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { DATALOADER_CONTEXT_KEY } from './dataloader.interceptor';
import { NestDataLoader } from './dataloader.interface';

export const Loader = createParamDecorator(
  async <
    K = unknown,
    V = unknown,
    T extends NestDataLoader<K, V> = NestDataLoader<K, V>,
  >(
    data: Type<T>,
    context: ExecutionContext,
  ) => {
    const gqlContext = GqlExecutionContext.create(context).getContext();

    if (!gqlContext[DATALOADER_CONTEXT_KEY]) {
      throw new InternalServerErrorException(
        'DataLoaderInterceptor must be provided in your app module',
      );
    }

    return await gqlContext[DATALOADER_CONTEXT_KEY].getLoader(data);
  },
);
