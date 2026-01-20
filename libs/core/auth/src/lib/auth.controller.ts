import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  AuthenticatedUser,
  CurrentUser,
  Public,
} from '@launchline/core-common';
import { DomainExceptionCode } from '@launchline/models';
import { OtpAuthGuard } from './otp.guard';
import { AuthService } from './auth.service';
import { SendOtpDto } from './auth.models';

@Controller({ version: VERSION_NEUTRAL, path: 'auth' })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login/otp/send')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() { email }: SendOtpDto) {
    const success = await this.authService.sendEmailOtp(email);

    if (!success) {
      throw new BadRequestException({
        code: DomainExceptionCode.OTP_UNAVAILABLE_FOR_THIS_NUMBER,
      });
    }

    return {
      success,
    };
  }

  @Public()
  @Post('login/otp/verify')
  @UseGuards(OtpAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async currentUser(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await new Promise((resolve, reject) =>
      req.logout((err) => {
        if (err) {
          this.logger.error(
            {
              error: err,
              userId: user.userId,
            },
            'Failed to logout',
          );

          reject(new BadRequestException('Failed to logout'));
        }

        res.clearCookie(this.configService.getOrThrow('marketing.cookieName'));

        resolve(true);
      }),
    );
  }
}
