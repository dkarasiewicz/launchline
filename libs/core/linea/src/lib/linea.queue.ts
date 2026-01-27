import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventType,
  EVENT_BUS_EXCHANGE,
  EventType,
  IntegrationConnectedEvent,
  Public,
} from '@launchline/core-common';
import {
  IntegrationFacade,
  IntegrationType,
} from '@launchline/core-integration';
import {
  RabbitSubscribe,
  MessageHandlerErrorBehavior,
} from '@golevelup/nestjs-rabbitmq';
import { OnboardingGraphsFactory } from './services';
import { LineaFacade } from './linea.facade';
import { randomUUID } from 'crypto';

const LINEA_DOMAIN = 'LINEA';

@Injectable()
export class LineaQueue {
  private readonly logger = new Logger(LineaQueue.name);

  constructor(
    private readonly onboardingGraphsFactory: OnboardingGraphsFactory,
    private readonly integrationFacade: IntegrationFacade,
    private readonly lineaFacade: LineaFacade,
  ) {}

  @Public()
  @RabbitSubscribe({
    exchange: EVENT_BUS_EXCHANGE,
    routingKey: 'events.#',
    queue: `${LINEA_DOMAIN}-domain-queue`,
    errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
  })
  public async handleMessage(domainEvent: DomainEventType) {
    this.logger.debug({ domainEvent }, 'Received domain event');

    switch (domainEvent.eventType) {
      case EventType.INTEGRATION_CONNECTED: {
        await this.handleIntegrationConnected(
          domainEvent as IntegrationConnectedEvent,
        );
        break;
      }
    }
  }

  private async handleIntegrationConnected(
    event: IntegrationConnectedEvent,
  ): Promise<void> {
    const { payload } = event;

    this.logger.log(
      `Integration connected: ${payload.integrationType} for workspace ${payload.workspaceId}`,
    );

    // Handle Linear integration onboarding
    if (payload.integrationType === IntegrationType.LINEAR) {
      await this.triggerLinearOnboarding(
        payload.integrationId,
        payload.workspaceId,
        payload.userId,
      );
    }

    // Future: Handle other integration types
    // if (payload.integrationType === IntegrationType.GITHUB) { ... }
    // if (payload.integrationType === IntegrationType.SLACK) { ... }
  }

  private async triggerLinearOnboarding(
    integrationId: string,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(
      `Triggering Linear onboarding for workspace ${workspaceId}`,
    );

    try {
      // Get the access token for the integration
      const accessToken =
        await this.integrationFacade.getAccessToken(integrationId);

      if (!accessToken) {
        this.logger.error(
          `No access token found for integration ${integrationId}`,
        );
        return;
      }

      // Create graph context
      const ctx = {
        workspaceId,
        userId,
        correlationId: randomUUID(),
      };

      // Run Linear onboarding
      const result = await this.onboardingGraphsFactory.runLinearOnboarding(
        ctx,
        accessToken,
        // No specific team ID - onboard entire organization
      );

      this.logger.log(
        `Linear onboarding completed for workspace ${workspaceId}`,
        {
          memoriesCreated: result.memoriesCreated.length,
          inboxCandidates: result.inboxCandidates.length,
          errors: result.errors.length,
        },
      );

      // Create inbox threads for detected items
      if (result.inboxCandidates.length > 0) {
        this.logger.log(
          `Creating ${result.inboxCandidates.length} inbox threads from Linear onboarding`,
        );

        for (const candidate of result.inboxCandidates) {
          try {
            await this.lineaFacade.createInboxThread({
              workspaceId,
              userId,
              type: candidate.type,
              priority: candidate.priority,
              title: candidate.title,
              summary: candidate.summary,
              suggestedActions: candidate.suggestedActions,
              sourceMemoryIds: candidate.sourceMemoryIds,
              entityRefs: candidate.entityRefs,
            });
          } catch (err) {
            this.logger.warn(
              `Failed to create inbox thread for candidate ${candidate.id}:`,
              err,
            );
          }
        }
      }

      if (result.errors.length > 0) {
        this.logger.warn(`Linear onboarding had errors:`, result.errors);
      }
    } catch (error) {
      this.logger.error(
        `Failed to trigger Linear onboarding for workspace ${workspaceId}`,
        error,
      );
      throw error; // Re-throw to trigger requeue
    }
  }
}
