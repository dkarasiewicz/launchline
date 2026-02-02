import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        return {
          connection: {
            host: configService.get('cache.host'),
            port: configService.get('cache.port'),
            username: configService.get('cache.username'),
            password: configService.get('cache.password'),
            tls: configService.get('cache.sslEnabled')
              ? {
                  rejectUnauthorized: false,
                }
              : undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [BullModule],
})
export class JobsModule {}
