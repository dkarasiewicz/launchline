import { Injectable, Logger } from '@nestjs/common';
import { LinearClient } from '@linear/sdk';

/**
 * Linear API Service
 *
 * Provides typed access to Linear API using the official SDK.
 * Used for fetching data and creating webhooks.
 */
@Injectable()
export class LinearService {
  private readonly logger = new Logger(LinearService.name);

  /**
   * Create a Linear client with the given access token
   */
  createClient(accessToken: string): LinearClient {
    return new LinearClient({ accessToken });
  }

  /**
   * Get the current user (viewer) information
   */
  async getViewer(accessToken: string): Promise<{
    id: string;
    name: string;
    email: string;
  }> {
    const client = this.createClient(accessToken);
    const viewer = await client.viewer;

    return {
      id: viewer.id,
      name: viewer.name,
      email: viewer.email,
    };
  }

  /**
   * Get the organization information
   */
  async getOrganization(accessToken: string): Promise<{
    id: string;
    name: string;
    urlKey: string;
  }> {
    const client = this.createClient(accessToken);
    const org = await client.organization;

    return {
      id: org.id,
      name: org.name,
      urlKey: org.urlKey,
    };
  }

  /**
   * Create a webhook in Linear
   *
   * @param accessToken - Linear access token
   * @param webhookUrl - The URL to receive webhook events
   * @param secret - Secret for webhook signature verification
   * @param resourceTypes - Types of resources to listen for (e.g., ['Issue', 'Comment', 'Project'])
   * @returns The created webhook ID
   */
  async createWebhook(
    accessToken: string,
    webhookUrl: string,
    secret: string,
    resourceTypes: string[] = ['Issue', 'Comment', 'Project', 'Cycle'],
  ): Promise<{ webhookId: string; enabled: boolean }> {
    const client = this.createClient(accessToken);

    const webhook = await client.createWebhook({
      url: webhookUrl,
      resourceTypes,
      secret,
      enabled: true,
      allPublicTeams: true, // Subscribe to all teams
    });

    if (!webhook.success || !webhook.webhook) {
      this.logger.error(
        {
          webhook,
        },
        'Failed to create Linear webhook',
      );
      throw new Error('Failed to create Linear webhook');
    }

    const createdWebhook = await webhook.webhook;

    this.logger.log(
      { webhookId: createdWebhook.id },
      'Created Linear webhook',
    );

    return {
      webhookId: createdWebhook.id,
      enabled: createdWebhook.enabled,
    };
  }

  /**
   * Delete a webhook from Linear
   */
  async deleteWebhook(accessToken: string, webhookId: string): Promise<void> {
    const client = this.createClient(accessToken);

    try {
      await client.deleteWebhook(webhookId);
      this.logger.log({ webhookId }, 'Deleted Linear webhook');
    } catch (error) {
      this.logger.error(
        { err: error, webhookId },
        'Failed to delete Linear webhook',
      );
      throw error;
    }
  }

  /**
   * List all webhooks for the organization
   */
  async listWebhooks(accessToken: string): Promise<
    Array<{
      id: string;
      url: string | null | undefined;
      enabled: boolean;
      resourceTypes: string[];
    }>
  > {
    const client = this.createClient(accessToken);
    const webhooks = await client.webhooks();

    return webhooks.nodes.map((w) => ({
      id: w.id,
      url: w.url,
      enabled: w.enabled,
      resourceTypes: w.resourceTypes,
    }));
  }

  /**
   * Verify a Linear webhook signature
   *
   * Linear uses HMAC-SHA256 for webhook signatures.
   * The signature is in the 'linear-signature' header.
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Linear sends the signature as a hex string
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }
}
