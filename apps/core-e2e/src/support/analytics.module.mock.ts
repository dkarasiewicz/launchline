import { Global, Module } from '@nestjs/common';

import { ANALYTICS_CLIENT } from '@launchline/core-common';

@Global()
@Module({
  providers: [
    {
      provide: ANALYTICS_CLIENT,
      useValue: {
        capture: jest.fn(),
        alias: jest.fn(),
      },
    },
  ],
  exports: [ANALYTICS_CLIENT],
})
export class MockAnalyticsModule {}
