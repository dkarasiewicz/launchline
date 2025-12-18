import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EVENT_BUS_EXCHANGE } from './tokens';
import { EventBusService } from './eventbus.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        return {
          exchanges: [
            {
              name: EVENT_BUS_EXCHANGE,
              type: 'topic',
              options: {
                durable: true,
              },
            },
          ],
          uri: configService.get<string>('eventBus.rabbitMqUrl'),
          connectionInitOptions: { wait: true },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [EventBusService],
  exports: [RabbitMQModule, EventBusService],
})
export class EventbusModule {}
