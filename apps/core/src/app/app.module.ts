import { Module, RequestMethod, Logger } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPlugin, BaseContext } from '@apollo/server';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { Redis } from 'ioredis';
import type { Response, Request } from 'express';
import {
  CACHE_STORE,
  CommonModule,
  REDIS_CLIENT,
} from '@launchline/core-common';
import { AuthModule } from '@launchline/core-auth';
import { WorkspaceModule } from '@launchline/core-workspace';
import { LineaModule } from '@launchline/core-linea';
import { config, validate } from './configuration';
import {
  decorateGQLSubscriptionRequest,
  getOrCreateMarketingSessionId,
} from './session.helper';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get('logLevel'),
          transport: configService.get('logPretty')
            ? { target: 'pino-pretty' }
            : undefined,
          genReqId: (req, res) => {
            const id =
              (req.id as string) ?? req.headers['x-request-id'] ?? randomUUID();

            res.setHeader('X-Request-Id', id);

            return id;
          },
        },
        exclude: [{ method: RequestMethod.ALL, path: 'health' }],
      }),
      inject: [ConfigService],
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: (
        httpServer: HttpAdapterHost,
        configService: ConfigService,
        redisClient: Redis,
      ) => {
        const logger = new Logger('GQL');

        return {
          autoSchemaFile: true,
          playground: false,
          subscriptions: {
            'graphql-ws': {
              onConnect: async (context) => {
                const request = (context?.extra as Record<string, never>)
                  .request;

                return decorateGQLSubscriptionRequest(
                  redisClient,
                  configService,
                  request,
                );
              },
            },
          },
          context: ({ extra, req, res }: Record<string, unknown>) => {
            const sessionId =
              (req as Record<string, unknown> | undefined)?.sessionID ||
              (extra as { request: Record<string, unknown> } | undefined)
                ?.request?.sessionID;
            const user =
              (req as Record<string, unknown> | undefined)?.user ||
              (extra as { request: Record<string, unknown> } | undefined)
                ?.request?.user;
            const marketingId = res
              ? getOrCreateMarketingSessionId(
                  res as Response,
                  configService,
                  logger,
                  req as Request,
                )
              : undefined;

            return {
              user,
              sessionId,
              marketingId,
            };
          },
          plugins: [
            ...((configService.get('enableApolloLandingPage')
              ? [ApolloServerPluginLandingPageLocalDefault()]
              : []) as unknown as ApolloServerPlugin<BaseContext>[]),
            ApolloServerPluginDrainHttpServer({
              httpServer: {
                ...(httpServer.httpAdapter.getInstance() as object),
                close: (cb: unknown) =>
                  httpServer.httpAdapter.getHttpServer().close(cb),
              } as never,
            }) as unknown as ApolloServerPlugin<BaseContext>,
          ],
          formatError: (error) => {
            logger.debug('GQL request failed', {
              error: error.extensions?.originalError || error,
            });

            return {
              message: error.message,
              code: error.extensions?.code || 'SERVER_ERROR',
              cause: error.extensions?.originalError,
            };
          },
        };
      },
      inject: [HttpAdapterHost, ConfigService, REDIS_CLIENT],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
      validate,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (cacheStore: KeyvRedis<unknown>) => ({
        stores: cacheStore,
        namespace: 'core-cache',
      }),
      inject: [CACHE_STORE],
    }),
    PassportModule.register({ session: true }),
    ScheduleModule.forRoot(),
    CommonModule,
    AuthModule,
    WorkspaceModule,
    LineaModule,
  ],
})
export class AppModule {}
