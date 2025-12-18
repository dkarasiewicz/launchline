import { PassportSerializer } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '@launchline/core-common';

@Injectable()
export class AuthSerializer extends PassportSerializer {
  serializeUser(
    user: AuthenticatedUser,
    done: (err: Error | null, user?: AuthenticatedUser) => void,
  ): void {
    done(null, user);
  }

  deserializeUser(
    payload: AuthenticatedUser,
    done: (err: Error | null, payload?: AuthenticatedUser) => void,
  ): void {
    done(null, payload);
  }
}
