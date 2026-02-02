import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly linearClientId: string | undefined = this.configService.get(
    'integrations.linear.clientId',
  );
  private readonly linearClientSecret: string | undefined =
    this.configService.get('integrations.linear.clientSecret');

  constructor(private readonly configService: ConfigService) {}

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

  /**
   * Refresh a Linear access token using a refresh token.
   */
  async refreshAccessToken(
    integrationId: string,
    refreshToken: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt?: Date;
    tokenType?: string;
    scope?: string;
  }> {
    if (!this.linearClientId || !this.linearClientSecret) {
      throw new Error('Linear integration is not configured');
    }

    if (!refreshToken) {
      throw new Error('Linear refresh token is missing');
    }

    const response = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.linearClientId,
        client_secret: this.linearClientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();

      this.logger.error(
        { error, integrationId },
        'Linear token refresh failed',
      );

      throw new Error('Failed to refresh Linear access token');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    if (!data?.access_token) {
      this.logger.error(
        { integrationId, data },
        'Linear token refresh missing access token',
      );

      throw new Error('Failed to refresh Linear access token');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      tokenType: data.token_type || 'Bearer',
      tokenExpiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scope: data.scope,
    };
  }
}
