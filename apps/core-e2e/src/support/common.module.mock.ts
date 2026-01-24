import { Global, Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { MockMainAuthGuard } from './auth.guard.mock';
import {
  DataLoaderInterceptor,
  PaginationService,
} from '@launchline/core-common';

@Global()
@Module({
  providers: [
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
      provide: 'APP_GUARD',
      useClass: MockMainAuthGuard,
    },
    {
      provide: 'APP_INTERCEPTOR',
      useClass: DataLoaderInterceptor,
    },
    PaginationService,
  ],
  exports: [PaginationService],
})
export class MockCommonModule {}
