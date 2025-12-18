import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB_CONNECTION } from '../db/tokens';
import { addTimeout } from '../utils';

@Injectable()
export class DbIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const isHealthy = await addTimeout(this.db.execute('select 1'), {
        milliseconds: 2000,
      });

      if (!isHealthy.rows.length) {
        return indicator.down({ error: 'Cannot obtain data from SELECT 1' });
      }

      return indicator.up();
    } catch (e) {
      return indicator.down({ error: e });
    }
  }
}
