import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationResolver } from './integration.resolver';
import { IntegrationService } from './integration.service';
import { IntegrationFacade } from './integration.facade';
import { LinearService } from './linear.service';
import { SlackService } from './slack.service';
import { GoogleService } from './google.service';
import { GitHubService } from './github.service';
import { IntegrationOAuthService } from './integration.oauth.service';
import { IntegrationWebhookService } from './integration.webhook.service';
import { SlackBoltService } from './slack-bolt.service';

@Module({
  imports: [],
  controllers: [IntegrationController],
  providers: [
    LinearService,
    SlackService,
    GoogleService,
    GitHubService,
    IntegrationService,
    IntegrationOAuthService,
    IntegrationWebhookService,
    SlackBoltService,
    IntegrationResolver,
    IntegrationFacade,
  ],
  exports: [
    IntegrationFacade,
    LinearService,
    SlackService,
    GoogleService,
    GitHubService,
  ],
})
export class IntegrationModule {}
