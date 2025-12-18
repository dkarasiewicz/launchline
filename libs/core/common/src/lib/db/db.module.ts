import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolConfig } from 'pg';

import { DB_CONNECTION } from './tokens';

@Global()
@Module({
  providers: [
    {
      provide: DB_CONNECTION,
      useFactory: (configService: ConfigService) => {
        const config: PoolConfig = {
          host: configService.get('database.host'),
          port: configService.get('database.port'),
          user: configService.get('database.user'),
          password: configService.get('database.password'),
          database: configService.get('database.database'),
          max: configService.get('database.max'),
          idleTimeoutMillis: configService.get('database.idleTimeoutMillis'),
          connectionTimeoutMillis: configService.get(
            'database.connectionTimeoutMillis',
          ),
          keepAlive: configService.get('database.keepAlive'),
          query_timeout: configService.get('database.queryTimeout'),
          statement_timeout: configService.get('database.statementTimeout'),
          application_name: configService.get('database.applicationName'),
          ssl: configService.get('database.ssl'),
          idle_in_transaction_session_timeout: configService.get(
            'database.idleInTransactionSessionTimeout',
          ),
        };

        return drizzle({
          connection: config,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [DB_CONNECTION],
})
export class DbModule implements OnApplicationShutdown {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase & { $client: Pool },
  ) {}

  onApplicationShutdown() {
    return this.db.$client.end();
  }
}
