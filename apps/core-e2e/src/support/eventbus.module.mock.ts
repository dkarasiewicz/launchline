import { Global, Module } from '@nestjs/common';
import { EventBusService } from '@launchline/core-common';

@Global()
@Module({
  providers: [
    {
      provide: EventBusService,
      useFactory: () => {
        return {
          publish: jest.fn(),
          validateMessageString: jest.fn(),
        };
      },
    },
  ],
  exports: [EventBusService],
})
export class MockEventBusModule {}
