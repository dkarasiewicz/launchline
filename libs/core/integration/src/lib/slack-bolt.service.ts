import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { App, ExpressReceiver } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';
import { IntegrationWebhookService } from './integration.webhook.service';

@Injectable()
export class SlackBoltService implements OnModuleInit {
  private readonly logger = new Logger(SlackBoltService.name);
  private receiver: ExpressReceiver | null = null;
  public app: App | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly webhookService: IntegrationWebhookService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit(): void {
    const signingSecret = this.configService.get<string>(
      'integrations.slack.signingSecret',
    );

    if (!signingSecret) {
      this.logger.warn(
        { configKey: 'integrations.slack.signingSecret' },
        'Slack signing secret not configured, skipping Slack receiver setup',
      );
      return;
    }

    this.receiver = new ExpressReceiver({
      signingSecret,
      processBeforeResponse: true,
      endpoints: '/integrations/webhooks/slack',
    });

    this.app = new App({
      receiver: this.receiver,
    });

    this.app.event('message', async ({ body }) => {
      await this.handleSlackEvent(body);
    });

    this.app.event('app_mention', async ({ body }) => {
      await this.handleSlackEvent(body);
    });

    const expressApp = this.httpAdapterHost.httpAdapter.getInstance();
    expressApp.use(this.receiver.app);

    this.logger.log('Slack Bolt receiver mounted');
  }

  private async handleSlackEvent(body: Record<string, unknown>): Promise<void> {
    try {
      await this.webhookService.processSlackEvent(body);
    } catch (error) {
      this.logger.error({ err: error }, 'Slack event processing failed');
    }
  }

  getClient(): WebClient {
    if (!this.app) {
      throw new Error('Slack client not initialized');
    }
    return this.app.client;
  }
}
