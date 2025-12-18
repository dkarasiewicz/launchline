import { Strategy } from 'passport-custom';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from '@launchline/core-common';
import { Request } from 'express';
import { validate } from 'class-validator';
import { PhoneNumberOtpBody } from './auth.models';

@Injectable()
export class OtpStrategy extends PassportStrategy(Strategy, 'otp') {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(req: Request): Promise<AuthenticatedUser> {
    const { email, code } = req.body;
    const otpBody = new PhoneNumberOtpBody();

    otpBody.phoneNumber = email;
    otpBody.code = code;

    const errors = await validate(otpBody);

    if (errors.length) {
      throw new UnauthorizedException(errors, 'Payload validation failed');
    }

    const user = await this.authService.verifyEmailOtp(email, code);

    if (!user) {
      throw new UnauthorizedException('Invalid verification code');
    }

    return user;
  }
}
