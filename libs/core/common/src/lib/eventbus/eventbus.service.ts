import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import {
  DomainEventType,
  EventType,
  EventTypeToDomainEventMap,
} from '../models';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { EVENT_BUS_EXCHANGE } from './tokens';

@Injectable()
export class EventBusService {
  private logger = new Logger(EventBusService.name);

  constructor(private readonly clientRMQ: AmqpConnection) {}

  async publish(message: DomainEventType): Promise<void> {
    const errors = await validate(message);

    if (errors.length > 0) {
      this.logger.error(`Invalid message: ${JSON.stringify(errors)}`);

      throw new BadRequestException('Invalid message format');
    }

    try {
      await this.clientRMQ.publish(
        EVENT_BUS_EXCHANGE,
        this.getTopicFromMessage(message),
        message,
        {
          persistent: true,
        },
      );

      this.logger.debug(`Message published`);
    } catch (error) {
      this.logger.error(`Failed to publish message: ${error}`);

      throw new InternalServerErrorException('Failed to publish message');
    }
  }

  async validateMessageString(
    messageString: string,
  ): Promise<DomainEventType | null> {
    try {
      const parsedMessage = JSON.parse(messageString);

      if (!parsedMessage.eventType) {
        this.logger.debug(`Invalid message string: ${messageString}`);

        return null;
      }

      const eventMessage: ClassConstructor<DomainEventType> | undefined =
        EventTypeToDomainEventMap[
          parsedMessage.eventType as keyof typeof EventTypeToDomainEventMap
        ];

      if (!eventMessage) {
        this.logger.debug(`Invalid event type: ${parsedMessage.eventType}`);

        return null;
      }

      const event = plainToInstance(eventMessage, parsedMessage);
      const errors = await validate(event);

      if (errors.length > 0) {
        this.logger.debug(`Invalid message string: ${JSON.stringify(errors)}`);

        return null;
      }

      return event;
    } catch (error) {
      this.logger.debug(`Failed to parse message string: ${error}`);

      return null;
    }
  }

  getTopicFromMessage(message: DomainEventType): string {
    return `events.${message.origin}.${message.version}.${message.eventType}.${message.userId || 'system'}`;
  }
}
