import { Injectable, Logger } from '@nestjs/common';
import {
  Domain,
  DomainEventType,
  EVENT_BUS_EXCHANGE,
  EventType,
  Public,
  WorkspaceMemberJoinedEvent,
} from '@launchline/core-common';
import { AuthService } from './auth.service';
import { UserRole, WorkspaceMemberRole } from '@launchline/models';
import {
  RabbitSubscribe,
  MessageHandlerErrorBehavior,
} from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class AuthQueue {
  private readonly logger = new Logger(AuthQueue.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @RabbitSubscribe({
    exchange: EVENT_BUS_EXCHANGE,
    routingKey: 'events.#',
    queue: `${Domain.AUTH}-domain-queue`,
    errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
  })
  public async handleMessage(domainEvent: DomainEventType) {
    this.logger.debug({ domainEvent }, 'Received domain event');

    switch (domainEvent.eventType) {
      case EventType.WORKSPACE_MEMBER_JOINED: {
        const { payload } = domainEvent as WorkspaceMemberJoinedEvent;

        await this.authService.createUnverifiedUserWithEmail(
          payload.userId,
          payload.email,
          payload.role === WorkspaceMemberRole.MEMBER
            ? UserRole.WORKSPACE_MEMBER
            : UserRole.WORKSPACE_ADMIN,
          payload.workspaceId,
          payload.fullName,
        );

        break;
      }
    }
  }
}
