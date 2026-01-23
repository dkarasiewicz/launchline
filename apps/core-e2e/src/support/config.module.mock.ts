import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useFactory: () => {
        return {
          get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
          getOrThrow: jest.fn(),
        };
      },
    },
  ],
  exports: [ConfigService],
})
export class MockConfigModule {}
