import { Injectable, Logger } from '@nestjs/common';

import { AuthService } from './auth.service';
import { UserDTO } from '@launchline/core-common';

@Injectable()
export class AuthFacade {
  private logger = new Logger(AuthFacade.name);

  constructor(private readonly authService: AuthService) {}

  async getUserById(userId: string): Promise<UserDTO | null> {
    this.logger.debug(`Fetching user by ID: ${userId}`);

    return this.authService.getUserDTOById(userId);
  }
}
