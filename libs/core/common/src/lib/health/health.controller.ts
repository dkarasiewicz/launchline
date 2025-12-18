import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DbIndicator } from './db.indicator';
import { RedisIndicator } from './redis.indicator';
import { PubSubIndicator } from './pubsub.indicator';
import { CacheIndicator } from './cache.indicator';
import { Public } from '../decorators';

@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private dbIndicator: DbIndicator,
    private redisIndicator: RedisIndicator,
    private pubSubIndicator: PubSubIndicator,
    private cacheIndicator: CacheIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.dbIndicator.isHealthy('db'),
      () => this.redisIndicator.isHealthy('redis'),
      () => this.pubSubIndicator.isHealthy('pubSub'),
      () => this.cacheIndicator.isHealthy('cache'),
    ]);
  }
}
