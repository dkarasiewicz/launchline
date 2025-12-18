import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { AuthController } from './auth.controller';
import { MainAuthGuard } from './auth.guard';
import { AuthSerializer } from './auth.serializer';
import { OtpAuthGuard } from './otp.guard';
import { OtpStrategy } from './otp.strategy';
import { AuthQueue } from './auth.queue';
import { AuthFacade } from './auth.facade';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthResolver,
    MainAuthGuard,
    AuthSerializer,
    OtpStrategy,
    OtpAuthGuard,
    AuthQueue,
    AuthFacade,
    MainAuthGuard,
    {
      provide: APP_GUARD,
      useFactory: (authGuard: MainAuthGuard) => authGuard,
      inject: [MainAuthGuard],
    },
  ],
  exports: [AuthFacade],
})
export class AuthModule {}
