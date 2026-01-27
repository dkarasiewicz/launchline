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

  constructor(private readonly integrationService: IntegrationService) {}

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

  /**
   * Handle webhook events that need async processing
   * Webhooks are first received by the controller, stored, and then
   * processed asynchronously by this queue
   */
  @Public()
  @RabbitSubscribe({
    exchange: EVENT_BUS_EXCHANGE,
    routingKey: 'integration.webhook.#',
    queue: `${Domain.INTEGRATION}-webhook-queue`,
    errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
  })
  public async handleWebhookEvent(message: {
    integrationId: string;
    type: IntegrationType;
    payload: WebhookPayload;
  }) {
    this.logger.debug({ message }, 'Processing webhook event');

    try {
      switch (message.type) {
        case IntegrationType.LINEAR:
          await this.processLinearWebhook(
            message.integrationId,
            message.payload,
          );
          break;

        case IntegrationType.SLACK:
          await this.processSlackWebhook(
            message.integrationId,
            message.payload,
          );
          break;

        case IntegrationType.GITHUB:
          await this.processGitHubWebhook(
            message.integrationId,
            message.payload,
          );
          break;

        default:
          this.logger.warn(`Unknown integration type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error({ error, message }, 'Failed to process webhook event');
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
    payload: WebhookPayload,
  ): Promise<void> {
    this.logger.debug('Processing Linear webhook', {
      integrationId,
      type: payload.type,
    });

    // Parse Linear webhook payload
    const { type, action, data } = payload;

    switch (type) {
      case 'Issue':
        if (action === 'create') {
          // Handle issue created
          this.logger.log('Linear issue created', { issueId: data.id });
        } else if (action === 'update') {
          // Handle issue updated
          this.logger.log('Linear issue updated', { issueId: data.id });
        }
        break;

      case 'Comment':
        if (action === 'create') {
          // Handle comment created
          this.logger.log('Linear comment created', { commentId: data.id });
        }
        break;

      default:
        this.logger.debug(`Unhandled Linear webhook type: ${type}`);
    }

    // TODO: Create inbox items based on webhook data
    // TODO: Update memories in the graph
  }

  private async processSlackWebhook(
    integrationId: string,
    payload: WebhookPayload,
  ): Promise<void> {
    this.logger.debug('Processing Slack webhook', {
      integrationId,
      type: payload.type,
    });

    const { type, data } = payload;

    switch (type) {
      case 'message':
        // Handle message posted
        this.logger.log('Slack message received', { channel: data.channel });
        break;

      case 'reaction_added':
        // Handle reaction added
        this.logger.log('Slack reaction added', { reaction: data.reaction });
        break;

      default:
        this.logger.debug(`Unhandled Slack webhook type: ${type}`);
    }

    // TODO: Process Slack events for context
  }

  private async processGitHubWebhook(
    integrationId: string,
    payload: WebhookPayload,
  ): Promise<void> {
    this.logger.debug('Processing GitHub webhook', {
      integrationId,
      type: payload.type,
    });

    const { type, action, data } = payload;

    switch (type) {
      case 'pull_request':
        if (action === 'opened') {
          this.logger.log('GitHub PR opened', { prNumber: data.number });
        } else if (action === 'merged') {
          this.logger.log('GitHub PR merged', { prNumber: data.number });
        }
        break;

      case 'issues':
        if (action === 'opened') {
          this.logger.log('GitHub issue opened', { issueNumber: data.number });
        }
        break;

      case 'push':
        this.logger.log('GitHub push received', { ref: data.ref });
        break;

      default:
        this.logger.debug(`Unhandled GitHub webhook type: ${type}`);
    }

    // TODO: Process GitHub events for code context
  }
}
