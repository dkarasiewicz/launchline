import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { ModuleRef, ContextIdFactory } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { NestDataLoader } from './dataloader.interface';
import DataLoader from 'dataloader';

export const DATALOADER_CONTEXT_KEY = 'DATALOADER_CONTEXT_KEY';

@Injectable()
export class DataLoaderInterceptor implements NestInterceptor {
  constructor(private readonly moduleRef: ModuleRef) {}

  intercept<
    K = unknown,
    V = unknown,
    T extends NestDataLoader<K, V> = NestDataLoader<K, V>,
  >(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<DataLoader<K, V>> {
    const gqlContext = GqlExecutionContext.create(context).getContext();

    if (!gqlContext[DATALOADER_CONTEXT_KEY]) {
      const contextId = ContextIdFactory.create();

      gqlContext[DATALOADER_CONTEXT_KEY] = {
        contextId,
        getLoader: async (type: Type<T>): Promise<DataLoader<K, V>> => {
          const loaderType = type.name;

          if (!gqlContext[loaderType]) {
            try {
              gqlContext[loaderType] = (async () => {
                const loader = await this.moduleRef.resolve(type, contextId, {
                  strict: false,
                });

                return loader.generateDataLoader();
              })();
            } catch (e) {
              throw new InternalServerErrorException(
                `The loader ${loaderType} is not provided: ${e}`,
              );
            }
          }

          return gqlContext[loaderType];
        },
      };
    }

    return next.handle();
  }
}
