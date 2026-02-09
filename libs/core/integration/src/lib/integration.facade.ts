import { Injectable } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { IntegrationType, IntegrationStatus } from './integration.models';
import { GitHubService } from './github.service';

@Injectable()
export class IntegrationFacade {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly githubService: GitHubService,
  ) {}

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

  async getIntegration(integrationId: string) {
    return this.integrationService.getIntegration(integrationId);
  }

  async getAccessToken(integrationId: string): Promise<string | null> {
    const integration = await this.integrationService.getIntegration(
      integrationId,
    );

    if (!integration) {
      return null;
    }

    if (integration.type === IntegrationType.GITHUB) {
      if (integration.scopes && integration.scopes.length > 0) {
        return this.integrationService.getDecryptedAccessToken(integrationId);
      }

      if (integration.externalAccountId) {
        const token = await this.githubService.createInstallationAccessToken(
          integration.externalAccountId,
        );
        return token.token;
      }

      return null;
    }

    return this.integrationService.getDecryptedAccessToken(integrationId);
  }
}
