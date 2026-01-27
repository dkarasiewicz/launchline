import { Injectable, Logger } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import {
  IntegrationType,
  IntegrationStatus,
  StoredIntegration,
} from './integration.models';

/**
 * Integration Facade
 *
 * Public API for other modules to interact with integrations
 */
@Injectable()
export class IntegrationFacade {
  private readonly logger = new Logger(IntegrationFacade.name);

  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * Get all active integrations for a workspace
   */
  async getActiveIntegrations(
    workspaceId: string,
  ): Promise<StoredIntegration[]> {
    const integrations =
      await this.integrationService.listIntegrations(workspaceId);
    return integrations.filter((i) => i.status === IntegrationStatus.ACTIVE);
  }

  /**
   * Get integrations of a specific type for a workspace
   */
  async getIntegrationsByType(
    workspaceId: string,
    type: IntegrationType,
  ): Promise<StoredIntegration[]> {
    const integrations =
      await this.integrationService.listIntegrations(workspaceId);
    return integrations.filter(
      (i) => i.type === type && i.status === IntegrationStatus.ACTIVE,
    );
  }

  /**
   * Get decrypted access token for an integration
   * Used by other modules to make API calls to integrated systems
   */
  async getAccessToken(integrationId: string): Promise<string | null> {
    return this.integrationService.getDecryptedAccessToken(integrationId);
  }

  /**
   * Check if a workspace has a specific integration type active
   */
  async hasIntegration(
    workspaceId: string,
    type: IntegrationType,
  ): Promise<boolean> {
    const integrations = await this.getIntegrationsByType(workspaceId, type);
    return integrations.length > 0;
  }

  /**
   * Verify a webhook signature for an integration
   */
  async verifyWebhookSignature(
    integrationId: string,
    payload: string,
    signature: string,
  ): Promise<boolean> {
    return this.integrationService.verifyWebhookSignature(
      integrationId,
      payload,
      signature,
    );
  }
}
