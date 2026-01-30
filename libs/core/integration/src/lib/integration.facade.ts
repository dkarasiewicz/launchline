import { Injectable } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { IntegrationType, IntegrationStatus } from './integration.models';

@Injectable()
export class IntegrationFacade {
  constructor(private readonly integrationService: IntegrationService) {}

  async getIntegrationsByType(
    workspaceId: string,
    type: IntegrationType,
  ): Promise<{ id: string }[]> {
    const integrations = await this.integrationService.getIntegrationsByType(
      workspaceId,
      type,
    );

    return integrations.filter((i) => i.status === IntegrationStatus.ACTIVE);
  }

  async getAccessToken(integrationId: string): Promise<string | null> {
    return this.integrationService.getDecryptedAccessToken(integrationId);
  }
}
