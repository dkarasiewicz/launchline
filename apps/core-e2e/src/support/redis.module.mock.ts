import { Global, Module } from '@nestjs/common';
import { PUB_SUB } from '@launchline/core-common';

@Global()
@Module({
  providers: [
    {
      provide: PUB_SUB,
      useFactory: () => {
        return {
          publish: jest.fn(),
          asyncIterator: jest.fn(),
        };
      },
    },
  ],
  exports: [PUB_SUB],
})
export class MockRedisModule {}
