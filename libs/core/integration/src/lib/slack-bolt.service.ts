import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { App, ExpressReceiver } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { IntegrationWebhookService } from './integration.webhook.service';
import { IntegrationService } from './integration.service';
import { IntegrationType } from './integration.models';

@Injectable()
export class SlackBoltService implements OnModuleInit {
  private readonly logger = new Logger(SlackBoltService.name);
  private receiver: ExpressReceiver | null = null;
  public app: App | null = null;
  private readonly fallbackClient = new WebClient();
  private readonly authCache = new Map<
    string,
    { botToken: string; botId?: string; botUserId?: string }
  >();

  constructor(
    private readonly configService: ConfigService,
    private readonly webhookService: IntegrationWebhookService,
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly integrationService: IntegrationService,
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
      authorize: async ({ teamId, enterpriseId }) => {
        const externalOrgId = teamId || enterpriseId;

        if (!externalOrgId) {
          throw new Error('Slack team ID missing for authorization');
        }

        const integration =
          await this.integrationService.getActiveIntegrationByExternalOrganization(
            IntegrationType.SLACK,
            externalOrgId,
          );

        if (!integration) {
          throw new Error('No matching Slack integration found');
        }

        const botToken = await this.integrationService.getDecryptedAccessToken(
          integration.id,
        );

        if (!botToken) {
          throw new Error('Slack bot token missing');
        }

        const cached = this.authCache.get(integration.id);
        if (cached?.botToken === botToken) {
          return cached;
        }

        try {
          const authTest = await new WebClient(botToken).auth.test();
          const auth = {
            botToken,
            botId: authTest.bot_id,
            botUserId: authTest.user_id,
          };
          this.authCache.set(integration.id, auth);
          return auth;
        } catch (error) {
          this.logger.warn(
            { err: error, integrationId: integration.id },
            'Slack auth.test failed, returning bot token only',
          );
          const fallback = { botToken };
          this.authCache.set(integration.id, fallback);
          return fallback;
        }
      },
    });

    this.app.event(/.*/, async ({ body }) => {
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
    return this.app?.client ?? this.fallbackClient;
  }
}
