import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import KeyvRedis from '@keyv/redis';

import { CACHE_STORE } from '../redis/tokens';
import { addTimeout } from '../utils';

@Injectable()
export class CacheIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(CACHE_STORE) private readonly store: KeyvRedis<unknown>,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const isHealthy = await addTimeout(this.store.getMasterNodes(), {
        milliseconds: 4000,
      });

      if (!isHealthy.length) {
        return indicator.down({ error: 'Cannot ping redis' });
      }

      return indicator.up();
    } catch (e) {
      return indicator.down({ error: e });
    }
  }
}
