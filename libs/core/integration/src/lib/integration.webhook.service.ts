import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationType } from './integration.models';
import { IntegrationService } from './integration.service';
import { LinearService } from './linear.service';
import { GitHubService } from './github.service';
import {
  EventBusService,
  IntegrationWebhookReceivedEvent,
} from '@launchline/core-common';

@Injectable()
export class IntegrationWebhookService {
  private readonly logger = new Logger(IntegrationWebhookService.name);

  constructor(
    private readonly integrationService: IntegrationService,
    private readonly linearService: LinearService,
    private readonly githubService: GitHubService,
    private readonly configService: ConfigService,
    private readonly eventBusService: EventBusService,
  ) {}

  async processLinearWebhook(
    payload: Record<string, unknown>,
    rawBody: string,
    signature: string,
  ): Promise<{ processed: boolean; integrationId?: string }> {
    const organizationId = payload['organizationId'] as string | undefined;

    if (!organizationId) {
      this.logger.warn(
        { payloadKeys: Object.keys(payload) },
        'Linear webhook missing organizationId',
      );

      return { processed: false };
    }

    const integrationRecord =
      await this.integrationService.getActiveIntegrationByExternalOrganization(
        IntegrationType.LINEAR,
        organizationId,
      );

    if (!integrationRecord) {
      this.logger.warn(
        { organizationId },
        'No active Linear integration found for organization',
      );

      return { processed: false };
    }

    const isValid = this.linearService.verifyWebhookSignature(
      rawBody,
      signature,
      this.configService.get('integrations.linear.webhookSecret') as string,
    );

    if (!isValid) {
      this.logger.error(
        { organizationId, integrationId: integrationRecord.id },
        'Invalid Linear webhook signature',
      );

      return { processed: false };
    }

    const eventType = payload['type'] as string;
    const action = payload['action'] as string;
    const externalEventId = payload['webhookId'] as string | undefined;

    await this.eventBusService.publish(
      new IntegrationWebhookReceivedEvent({
        integrationId: integrationRecord.id,
        workspaceId: integrationRecord.workspaceId,
        integrationType: IntegrationType.LINEAR,
        eventType,
        action,
        externalEventId,
        payload: JSON.stringify(payload),
        emittedAt: new Date().toISOString(),
      }),
    );

    this.logger.debug(
      {
        integrationId: integrationRecord.id,
        eventType,
        action,
      },
      'Published Linear webhook event',
    );

    return { processed: true, integrationId: integrationRecord.id };
  }

  async processSlackEvent(
    payload: Record<string, unknown>,
  ): Promise<{ processed: boolean; integrationId?: string }> {
    const teamId =
      (payload['team_id'] as string | undefined) ||
      (payload['teamId'] as string | undefined);

    if (!teamId) {
      this.logger.warn(
        { payloadKeys: Object.keys(payload) },
        'Slack event missing team_id',
      );
      return { processed: false };
    }

    const integrationRecord =
      await this.integrationService.getActiveIntegrationByExternalOrganization(
        IntegrationType.SLACK,
        teamId,
      );

    if (!integrationRecord) {
      this.logger.warn(
        { teamId },
        'No active Slack integration found for team',
      );
      return { processed: false };
    }

    const event = payload['event'] as Record<string, unknown> | undefined;
    const eventType = (event?.['type'] as string) || 'slack_event';
    const action = event?.['subtype'] as string | undefined;
    const externalEventId = payload['event_id'] as string | undefined;

    await this.eventBusService.publish(
      new IntegrationWebhookReceivedEvent({
        integrationId: integrationRecord.id,
        workspaceId: integrationRecord.workspaceId,
        integrationType: IntegrationType.SLACK,
        eventType,
        action,
        externalEventId,
        payload: JSON.stringify(payload),
        emittedAt: new Date().toISOString(),
      }),
    );

    this.logger.debug(
      {
        integrationId: integrationRecord.id,
        eventType,
        action,
      },
      'Published Slack webhook event',
    );

    return { processed: true, integrationId: integrationRecord.id };
  }

  async processGitHubWebhook(input: {
    integrationId?: string;
    payload: Record<string, unknown>;
    rawBody: string;
    signature?: string;
    eventType?: string;
    deliveryId?: string;
  }): Promise<{ processed: boolean; integrationId?: string }> {
    const installationId =
      (input.payload['installation'] as { id?: number } | undefined)?.id;
    const integrationRecord = input.integrationId
      ? await this.integrationService.getIntegration(input.integrationId)
      : installationId
        ? await this.integrationService.getIntegrationByExternalAccountId(
            IntegrationType.GITHUB,
            String(installationId),
          )
        : null;

    if (!integrationRecord) {
      this.logger.warn(
        { integrationId: input.integrationId, installationId },
        'GitHub integration not found',
      );
      return { processed: false };
    }

    const webhookSecret =
      this.configService.get('integrations.github.webhookSecret') as string;

    const isValid = this.githubService.verifyWebhookSignature(
      input.rawBody,
      input.signature,
      webhookSecret,
    );

    if (!isValid) {
      this.logger.error(
        { integrationId: integrationRecord.id },
        'Invalid GitHub webhook signature',
      );
      return { processed: false };
    }

    const eventType = input.eventType || 'github_event';
    const action = (input.payload['action'] as string | undefined) || undefined;
    const externalEventId = input.deliveryId;

    await this.eventBusService.publish(
      new IntegrationWebhookReceivedEvent({
        integrationId: integrationRecord.id,
        workspaceId: integrationRecord.workspaceId,
        integrationType: IntegrationType.GITHUB,
        eventType,
        action,
        externalEventId,
        payload: JSON.stringify(input.payload),
        emittedAt: new Date().toISOString(),
      }),
    );

    this.logger.debug(
      {
        integrationId: integrationRecord.id,
        eventType,
        action,
      },
      'Published GitHub webhook event',
    );

    return { processed: true, integrationId: integrationRecord.id };
  }
}
