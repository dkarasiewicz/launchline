import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisPubSub } from 'graphql-redis-subscriptions';

import { PUB_SUB } from '../redis/tokens';
import { addTimeout } from '../utils';

@Injectable()
export class PubSubIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(PUB_SUB) private readonly pubSub: RedisPubSub,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const sub = await addTimeout(this.ping(), {
        milliseconds: 2000,
      });

      if (sub !== 'ping') {
        return indicator.down({ error: 'Cannot ping PubSub' });
      }

      return indicator.up();
    } catch (e) {
      return indicator.down({ error: e });
    }
  }

  private async ping(): Promise<string> {
    const pingTopicId = `ping-${Date.now()}`;

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        const subId = await this.pubSub.subscribe(pingTopicId, (d: string) => {
          this.pubSub.unsubscribe(subId);

          resolve(d);
        });

        await this.pubSub.publish(pingTopicId, 'ping');
      } catch (e) {
        reject(e);
      }
    });
  }
}
