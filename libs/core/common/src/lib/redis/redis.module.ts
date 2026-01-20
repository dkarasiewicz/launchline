import {
  Global,
  Inject,
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisPubSub } from 'graphql-redis-subscriptions';
import { Redis, RedisOptions, Cluster } from 'ioredis';
import { createClient, createCluster } from 'redis';

import { CACHE_STORE, PUB_SUB, REDIS_CLIENT, REDIS_CONFIG } from './tokens';
import KeyvRedis from '@keyv/redis';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONFIG,
      useFactory: (configService: ConfigService): RedisOptions => ({
        host: configService.get('cache.host'),
        port: configService.get('cache.port'),
        username: configService.get('cache.username'),
        password: configService.get('cache.password'),
        tls: configService.get('cache.sslEnabled')
          ? {
              rejectUnauthorized: false,
            }
          : undefined,
      }),
      inject: [ConfigService],
    },
    {
      provide: PUB_SUB,
      useFactory: (config: RedisOptions, configService: ConfigService) =>
        new RedisPubSub({
          subscriber: configService.get('cache.clusterMode')
            ? new Cluster(
                [
                  {
                    port: config.port,
                    host: config.host,
                  },
                ],
                {
                  slotsRefreshTimeout: 5000,
                  redisOptions: {
                    username: config.username,
                    password: config.password,
                    tls: config.tls,
                  },
                },
              )
            : new Redis(config),
          publisher: configService.get('cache.clusterMode')
            ? new Cluster(
                [
                  {
                    port: config.port,
                    host: config.host,
                  },
                ],
                {
                  slotsRefreshTimeout: 5000,
                  redisOptions: {
                    username: config.username,
                    password: config.password,
                    tls: config.tls,
                  },
                },
              )
            : new Redis(config),
        }),
      inject: [REDIS_CONFIG, ConfigService],
    },
    {
      provide: REDIS_CLIENT,
      useFactory: (config: RedisOptions, configService: ConfigService) =>
        configService.get('cache.clusterMode')
          ? createCluster({
              rootNodes: [
                {
                  url: `redis://${config.host}:${config.port}`,
                },
              ],
              defaults: {
                username: config.username,
                password: config.password,
                socket: config.tls
                  ? {
                      tls: true,
                    }
                  : {},
              },
            })
          : createClient({
              password: config.password,
              username: config.username,
              socket: config.tls
                ? {
                    host: config.host,
                    port: config.port,
                    tls: true,
                  }
                : {
                    host: config.host,
                    port: config.port,
                  },
            }),
      inject: [REDIS_CONFIG, ConfigService],
    },
    {
      provide: CACHE_STORE,
      useFactory: async (configService: ConfigService) => {
        const url = `redis://${configService.get(
          'cache.host',
        )}:${configService.get(`cache.port`)}`;

        return new KeyvRedis({
          ...(configService.get('cache.clusterMode')
            ? { rootNodes: [{ url }] }
            : { url }),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [PUB_SUB, REDIS_CLIENT, CACHE_STORE],
})
export class RedisModule
  implements OnApplicationShutdown, OnApplicationBootstrap
{
  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @Inject(PUB_SUB) private readonly pubSub: RedisPubSub,
  ) {}

  async onApplicationBootstrap() {
    await this.redisClient.connect();
  }

  async onApplicationShutdown() {
    await Promise.all([this.pubSub.close(), this.redisClient.quit()]);
  }
}
