import { Global, Module } from '@nestjs/common';
import { DB_CONNECTION } from '@launchline/core-common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PoolConfig } from 'pg';

@Global()
@Module({
  providers: [
    {
      provide: DB_CONNECTION,
      useFactory: () => {
        console.log('connecting to db with', {
          user: process.env,
          password: process.env['DB_PASS'],
          database: process.env['DB_DATABASE'],
          host: process.env['DB_HOST'],
          port: parseInt(process.env['DB_PORT'], 10),
        });
        return drizzle({
          connection: {
            user: process.env['DB_USERNAME'] as string,
            password: process.env['DB_PASS'],
            database: process.env['DB_DATABASE'],
            host: process.env['DB_HOST'],
            port: parseInt(process.env['DB_PORT'], 10),
          } satisfies PoolConfig,
        });
      },
    },
  ],
  exports: [DB_CONNECTION],
})
export class MockDbModule {}
