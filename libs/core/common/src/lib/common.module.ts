import { Global, Module, ValidationPipe } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { DbIndicator } from './health/db.indicator';
import { DbModule } from './db/db.module';
import { RedisModule } from './redis/redis.module';
import { RedisIndicator } from './health/redis.indicator';
import { PubSubIndicator } from './health/pubsub.indicator';
import { CacheIndicator } from './health/cache.indicator';
import { PaginationService } from './utils';
import { AnalyticsModule } from './analytics/analytics.module';
import { EventbusModule } from './eventbus/eventbus.module';
import { JobsModule } from './jobs/jobs.module';
import { DataLoaderInterceptor } from './dataloader';

@Global()
@Module({
  imports: [
    DbModule,
    RedisModule,
    EventbusModule,
    AnalyticsModule,
    JobsModule,
    TerminusModule.forRoot({
      gracefulShutdownTimeoutMs: parseInt(
        process.env['GRACEFUL_SHUTDOWN_TIMEOUT_MS'] || '0',
        10,
      ),
    }),
  ],
  controllers: [HealthController],
  providers: [
    DbIndicator,
    RedisIndicator,
    PubSubIndicator,
    CacheIndicator,
    PaginationService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DataLoaderInterceptor,
    },
  ],
  exports: [
    DbModule,
    RedisModule,
    EventbusModule,
    PaginationService,
    AnalyticsModule,
    JobsModule,
  ],
})
export class CommonModule {}
