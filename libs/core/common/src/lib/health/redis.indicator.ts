import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../redis/tokens';
import { addTimeout } from '../utils';

@Injectable()
export class RedisIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const isHealthy = await addTimeout(this.redis.ping(), {
        milliseconds: 2000,
      });

      if (isHealthy !== 'PONG') {
        return indicator.down({ error: 'Cannot ping redis' });
      }

      return indicator.up();
    } catch (e) {
      return indicator.down({ error: e });
    }
  }
}
