import { Injectable, Logger } from '@nestjs/common';
import {
  Domain,
  DomainEventType,
  EVENT_BUS_EXCHANGE,
  EventType,
  Public,
} from '@launchline/core-common';
import {
  RabbitSubscribe,
  MessageHandlerErrorBehavior,
} from '@golevelup/nestjs-rabbitmq';
import { IntegrationService } from './integration.service';
import { IntegrationType, WebhookPayload } from './integration.models';
import { LineaFacade } from '@launchline/core-linea';

/**
 * Integration Queue Service
 *
 * Handles:
 * 1. Incoming domain events that need to be sent to integrated systems (outbox pattern)
 * 2. Webhook events that need to be processed asynchronously
 */
@Injectable()
export class IntegrationQueue {
  private readonly logger = new Logger(IntegrationQueue.name);

  constructor(
    private readonly integrationService: IntegrationService,
    private readonly lineaFacade: LineaFacade,
  ) {}

  /**
   * Handle domain events and send updates to integrated systems
   * This implements the outbox pattern - listening for internal events
   * and pushing them to external integrations
   */
  @Public()
  @RabbitSubscribe({
    exchange: EVENT_BUS_EXCHANGE,
    routingKey: 'events.#',
    queue: `${Domain.INTEGRATION}-outbox-queue`,
    errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
  })
  public async handleDomainEvent(domainEvent: DomainEventType) {
    this.logger.debug(
      { domainEvent },
      'Received domain event for outbox processing',
    );

    try {
      // Based on event type, determine which integrations should be notified
      switch (domainEvent.eventType) {
        // Handle incoming webhooks
        case EventType.INTEGRATION_WEBHOOK_RECEIVED:
          await this.handleWebhookReceived(domainEvent as any);
          break;

        // Example: When a ticket status changes, notify Linear
        case EventType.TICKET_STATUS_CHANGED:
          await this.notifyLinear(domainEvent);
          break;

        // Example: When a comment is added, notify Slack
        case EventType.COMMENT_ADDED:
          await this.notifySlack(domainEvent);
          break;

        // Example: When code is pushed, notify GitHub
        case EventType.CODE_PUSHED:
          await this.notifyGitHub(domainEvent);
          break;

        default:
          // Not all events need to be forwarded to integrations
          this.logger.debug(
            `Event ${domainEvent.eventType} does not require integration notification`,
          );
      }
    } catch (error) {
      this.logger.error(
        { error, domainEvent },
        'Failed to process domain event for integrations',
      );
      throw error; // Requeue the message
    }
  }

  // ============================================================================
  // Webhook Handler
  // ============================================================================

  private async handleWebhookReceived(event: any): Promise<void> {
    const { integrationId, workspaceId, integrationType, webhookPayload } =
      event.payload;

    this.logger.log(
      `Processing webhook for ${integrationType} integration ${integrationId}`,
    );

    try {
      switch (integrationType) {
        case IntegrationType.LINEAR:
          await this.processLinearWebhook(
            integrationId,
            workspaceId,
            webhookPayload,
          );
          break;

        case IntegrationType.SLACK:
          await this.processSlackWebhook(
            integrationId,
            workspaceId,
            webhookPayload,
          );
          break;

        case IntegrationType.GITHUB:
          await this.processGitHubWebhook(
            integrationId,
            workspaceId,
            webhookPayload,
          );
          break;

        default:
          this.logger.warn(`Unknown integration type: ${integrationType}`);
      }
    } catch (error) {
      this.logger.error(
        { error, integrationId, integrationType },
        'Failed to process webhook',
      );
      throw error; // Requeue the message
    }
  }

  // ============================================================================
  // Outbox Handlers - Send updates to integrated systems
  // ============================================================================

  private async notifyLinear(event: DomainEventType): Promise<void> {
    this.logger.debug('Notifying Linear about event', {
      eventType: event.eventType,
    });

    // TODO: Get all Linear integrations for the workspace
    // TODO: For each integration, send the update via Linear API
    // Example:
    // const integrations = await this.integrationService.listIntegrationsByType(
    //   event.workspaceId,
    //   IntegrationType.LINEAR,
    // );
    // for (const integration of integrations) {
    //   const accessToken = await this.integrationService.getDecryptedAccessToken(integration.id);
    //   // Call Linear API
    // }
  }

  private async notifySlack(event: DomainEventType): Promise<void> {
    this.logger.debug('Notifying Slack about event', {
      eventType: event.eventType,
    });

    // TODO: Get all Slack integrations for the workspace
    // TODO: For each integration, post message to configured channel
  }

  private async notifyGitHub(event: DomainEventType): Promise<void> {
    this.logger.debug('Notifying GitHub about event', {
      eventType: event.eventType,
    });

    // TODO: Get all GitHub integrations for the workspace
    // TODO: For each integration, create comment/issue/etc.
  }

  // ============================================================================
  // Webhook Processors - Handle incoming webhooks from integrated systems
  // ============================================================================

  private async processLinearWebhook(
    integrationId: string,
    workspaceId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.logger.debug('Processing Linear webhook', {
      integrationId,
      type: payload.type,
      action: payload.action,
    });

    // Determine event type
    const eventType = `${payload.type}.${payload.action}`;

    // Route to Linea for processing
    try {
      await this.lineaFacade.processWebhook({
        workspaceId,
        userId: 'system', // Webhooks don't have a specific user
        source: 'linear',
        eventType,
        payload,
      });

      this.logger.log(`Successfully processed Linear webhook: ${eventType}`);
    } catch (error) {
      this.logger.error(
        `Failed to process Linear webhook via Linea: ${error}`,
      );
      throw error;
    }
  }

  private async processSlackWebhook(
    integrationId: string,
    workspaceId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.logger.debug('Processing Slack webhook', {
      integrationId,
      type: payload.type,
    });

    const eventType = payload.type as string;

    try {
      await this.lineaFacade.processWebhook({
        workspaceId,
        userId: 'system',
        source: 'slack',
        eventType,
        payload,
      });

      this.logger.log(`Successfully processed Slack webhook: ${eventType}`);
    } catch (error) {
      this.logger.error(`Failed to process Slack webhook via Linea: ${error}`);
      throw error;
    }
  }

  private async processGitHubWebhook(
    integrationId: string,
    workspaceId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.logger.debug('Processing GitHub webhook', {
      integrationId,
      eventType: payload.__eventType,
    });

    const eventType = (payload.__eventType as string) || 'unknown';

    try {
      await this.lineaFacade.processWebhook({
        workspaceId,
        userId: 'system',
        source: 'github',
        eventType,
        payload,
      });

      this.logger.log(`Successfully processed GitHub webhook: ${eventType}`);
    } catch (error) {
      this.logger.error(
        `Failed to process GitHub webhook via Linea: ${error}`,
      );
      throw error;
    }
  }
}
