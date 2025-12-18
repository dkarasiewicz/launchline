import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { PostHog } from 'posthog-node';

import { ANALYTICS_CLIENT } from './tokens';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  providers: [
    {
      provide: ANALYTICS_CLIENT,
      useFactory: (configService: ConfigService) => {
        return new PostHog(configService.get('postHog.apiKey') as string, {
          disabled: configService.get('postHog.disabled'),
          host: configService.get('postHog.host') as string,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [ANALYTICS_CLIENT],
})
export class AnalyticsModule implements OnApplicationShutdown {
  constructor(
    @Inject(ANALYTICS_CLIENT) private readonly client: PostHog,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.shutdown(
      this.configService.get('gracefulShutdownTimeoutMs'),
    );
  }
}
