import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationResolver } from './integration.resolver';
import { IntegrationService } from './integration.service';
import { IntegrationQueue } from './integration.queue';
import { IntegrationFacade } from './integration.facade';
import { LineaModule } from '@launchline/core-linea';

@Module({
  imports: [LineaModule],
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
