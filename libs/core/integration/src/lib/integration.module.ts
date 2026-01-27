import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationResolver } from './integration.resolver';
import { IntegrationService } from './integration.service';
import { IntegrationQueue } from './integration.queue';
import { IntegrationFacade } from './integration.facade';

@Module({
  imports: [],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    IntegrationResolver,
    IntegrationQueue,
    IntegrationFacade,
  ],
  exports: [IntegrationFacade],
})
export class IntegrationModule {}
