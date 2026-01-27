import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  randomUUID,
  randomBytes,
  createHmac,
  createCipheriv,
  createDecipheriv,
} from 'crypto';
import {
  IntegrationType,
  IntegrationStatus,
  OAuthTokens,
  IntegrationConfig,
  StoredIntegration,
  OAuthState,
} from './integration.models';
import {
  DB_CONNECTION,
  EventBusService,
  IntegrationConnectedEvent,
  integration,
} from '@launchline/core-common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);
  private readonly encryptionKey: Buffer;
  private readonly integrationConfigs: Map<IntegrationType, IntegrationConfig>;

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly configService: ConfigService,
    private readonly eventBusService: EventBusService,
  ) {
    // Get encryption key from config (should be 32 bytes for AES-256)
    const key = this.configService.get<string>('INTEGRATION_ENCRYPTION_KEY');
    this.encryptionKey = Buffer.from(
      key || randomBytes(32).toString('hex'),
      'hex',
    );

    // Initialize integration configs
    this.integrationConfigs = this.loadIntegrationConfigs();
  }

  private loadIntegrationConfigs(): Map<IntegrationType, IntegrationConfig> {
    const configs = new Map<IntegrationType, IntegrationConfig>();

    // Linear
    const linearClientId = this.configService.get<string>('LINEAR_CLIENT_ID');
    const linearClientSecret = this.configService.get<string>(
      'LINEAR_CLIENT_SECRET',
    );
    if (linearClientId && linearClientSecret) {
      configs.set(IntegrationType.LINEAR, {
        type: IntegrationType.LINEAR,
        clientId: linearClientId,
        clientSecret: linearClientSecret,
        authorizationUrl: 'https://linear.app/oauth/authorize',
        tokenUrl: 'https://api.linear.app/oauth/token',
        scopes: ['read', 'write', 'issues:create', 'comments:create'],
        webhookPath: '/api/webhooks/linear',
      });
    }

    // Slack
    const slackClientId = this.configService.get<string>('SLACK_CLIENT_ID');
    const slackClientSecret = this.configService.get<string>(
      'SLACK_CLIENT_SECRET',
    );
    if (slackClientId && slackClientSecret) {
      configs.set(IntegrationType.SLACK, {
        type: IntegrationType.SLACK,
        clientId: slackClientId,
        clientSecret: slackClientSecret,
        authorizationUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        scopes: [
          'channels:history',
          'channels:read',
          'chat:write',
          'users:read',
        ],
        webhookPath: '/api/webhooks/slack',
      });
    }

    // GitHub
    const githubClientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const githubClientSecret = this.configService.get<string>(
      'GITHUB_CLIENT_SECRET',
    );
    if (githubClientId && githubClientSecret) {
      configs.set(IntegrationType.GITHUB, {
        type: IntegrationType.GITHUB,
        clientId: githubClientId,
        clientSecret: githubClientSecret,
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scopes: ['repo', 'read:user', 'read:org'],
        webhookPath: '/api/webhooks/github',
      });
    }

    return configs;
  }

  // ============================================================================
  // OAuth Flow
  // ============================================================================

  async startOAuth(
    userId: string,
    type: IntegrationType,
    workspaceId: string,
    redirectUrl?: string,
  ): Promise<{ authorizationUrl: string; state: string; workspaceId: string }> {
    const config = this.integrationConfigs.get(type);
    if (!config) {
      throw new Error(`Integration type ${type} is not configured`);
    }

    // Generate state for CSRF protection
    const state = randomBytes(32).toString('hex');
    const nonce = randomBytes(16).toString('hex');

    // Store state in database for verification
    const oauthState: OAuthState = {
      workspaceId,
      userId,
      type,
      redirectUrl,
      nonce,
      createdAt: new Date().toISOString(),
    };

    await this.db.insert(integrationOAuthState).values({
      id: randomUUID(),
      state,
      data: JSON.stringify(oauthState),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Build authorization URL
    const baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/api/integrations/oauth/${type}/callback`;

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
    });

    const authorizationUrl = `${config.authorizationUrl}?${params.toString()}`;

    this.logger.debug(`Started OAuth flow for ${type} integration`);

    return { authorizationUrl, state, workspaceId };
  }

  async completeOAuth(
    code: string,
    state: string,
  ): Promise<{ integrationId: string; redirectUrl?: string }> {
    // Verify state
    const [stateRecord] = await this.db
      .select()
      .from(integrationOAuthState)
      .where(
        and(
          eq(integrationOAuthState.state, state),
          eq(integrationOAuthState.consumed, false),
        ),
      );

    if (!stateRecord || new Date() > stateRecord.expiresAt) {
      throw new Error('Invalid or expired OAuth state');
    }

    const oauthState: OAuthState = JSON.parse(stateRecord.data);
    const config = this.integrationConfigs.get(oauthState.type);

    if (!config) {
      throw new Error(`Integration type ${oauthState.type} is not configured`);
    }

    // Mark state as consumed
    await this.db
      .update(integrationOAuthState)
      .set({ consumed: true, updatedAt: new Date() })
      .where(eq(integrationOAuthState.id, stateRecord.id));

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code, config);

    // Get external account info
    const accountInfo = await this.getExternalAccountInfo(
      oauthState.type,
      tokens.accessToken,
    );

    // Create or update integration
    const integrationId = randomUUID();
    const webhookSecret = randomBytes(32).toString('hex');
    const baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    const integrationData: StoredIntegration = {
      id: integrationId,
      workspaceId: oauthState.workspaceId,
      type: oauthState.type,
      status: IntegrationStatus.ACTIVE,
      externalAccountId: accountInfo.id,
      externalAccountName: accountInfo.name,
      scopes: config.scopes,
      webhookUrl: `${baseUrl}${config.webhookPath}`,
      webhookSecret,
      accessToken: this.encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken
        ? this.encrypt(tokens.refreshToken)
        : undefined,
      tokenType: tokens.tokenType,
      tokenExpiresAt: tokens.expiresAt?.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.db.insert(integration).values({
      id: integrationData.id,
      workspaceId: integrationData.workspaceId,
      type: integrationData.type,
      status: integrationData.status,
      name: integrationData.name,
      description: integrationData.description,
      externalAccountId: integrationData.externalAccountId,
      externalAccountName: integrationData.externalAccountName,
      scopes: integrationData.scopes,
      webhookUrl: integrationData.webhookUrl,
      webhookSecret: integrationData.webhookSecret,
      accessToken: integrationData.accessToken,
      refreshToken: integrationData.refreshToken,
      tokenType: integrationData.tokenType,
      tokenExpiresAt: integrationData.tokenExpiresAt
        ? new Date(integrationData.tokenExpiresAt)
        : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(
      `Created integration ${integrationId} for workspace ${oauthState.workspaceId}`,
    );

    // Emit integration connected event
    await this.eventBusService.publish(
      new IntegrationConnectedEvent(
        {
          integrationId,
          workspaceId: oauthState.workspaceId,
          userId: oauthState.userId,
          integrationType: oauthState.type,
          externalAccountId: accountInfo.id,
          externalAccountName: accountInfo.name,
          emittedAt: new Date().toISOString(),
        },
        oauthState.userId,
      ),
    );

    return { integrationId, redirectUrl: oauthState.redirectUrl };
  }

  private async exchangeCodeForTokens(
    code: string,
    config: IntegrationConfig,
  ): Promise<OAuthTokens> {
    const baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/api/integrations/oauth/callback`;

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Token exchange failed: ${error}`);
      throw new Error('Failed to exchange authorization code for tokens');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type || 'Bearer',
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scope: data.scope,
    };
  }

  private async getExternalAccountInfo(
    type: IntegrationType,
    accessToken: string,
  ): Promise<{ id: string; name: string }> {
    switch (type) {
      case IntegrationType.LINEAR: {
        const response = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            query: '{ viewer { id name } }',
          }),
        });
        const data = await response.json();
        return { id: data.data.viewer.id, name: data.data.viewer.name };
      }

      case IntegrationType.SLACK: {
        const response = await fetch('https://slack.com/api/auth.test', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json();
        return { id: data.user_id, name: data.user };
      }

      case IntegrationType.GITHUB: {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        const data = await response.json();
        return { id: String(data.id), name: data.login };
      }

      default:
        return { id: 'unknown', name: 'Unknown' };
    }
  }

  // ============================================================================
  // Integration Management
  // ============================================================================

  async listIntegrations(workspaceId: string): Promise<StoredIntegration[]> {
    const results = await this.db
      .select()
      .from(integration)
      .where(eq(integration.workspaceId, workspaceId));

    return results.map((r) => this.mapToStoredIntegration(r));
  }

  async getIntegration(
    integrationId: string,
  ): Promise<StoredIntegration | null> {
    const [result] = await this.db
      .select()
      .from(integration)
      .where(eq(integration.id, integrationId));

    if (!result) return null;

    return this.mapToStoredIntegration(result);
  }

  async updateIntegration(
    integrationId: string,
    updates: { name?: string; description?: string },
  ): Promise<void> {
    await this.db
      .update(integration)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(integration.id, integrationId));
  }

  async deleteIntegration(integrationId: string): Promise<void> {
    // TODO: Revoke tokens at the provider
    await this.db.delete(integration).where(eq(integration.id, integrationId));

    this.logger.log(`Deleted integration ${integrationId}`);
  }

  async refreshToken(integrationId: string): Promise<void> {
    const storedIntegration = await this.getIntegration(integrationId);
    if (!storedIntegration || !storedIntegration.refreshToken) {
      throw new Error('Integration not found or no refresh token available');
    }

    const config = this.integrationConfigs.get(storedIntegration.type);
    if (!config) {
      throw new Error(
        `Integration type ${storedIntegration.type} is not configured`,
      );
    }

    const refreshToken = this.decrypt(storedIntegration.refreshToken);

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      await this.db
        .update(integration)
        .set({
          status: IntegrationStatus.ERROR,
          updatedAt: new Date(),
        })
        .where(eq(integration.id, integrationId));

      throw new Error('Failed to refresh token');
    }

    const data = await response.json();

    await this.db
      .update(integration)
      .set({
        accessToken: this.encrypt(data.access_token),
        refreshToken: data.refresh_token
          ? this.encrypt(data.refresh_token)
          : undefined,
        tokenExpiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : null,
        status: IntegrationStatus.ACTIVE,
        updatedAt: new Date(),
      })
      .where(eq(integration.id, integrationId));

    this.logger.log(`Refreshed token for integration ${integrationId}`);
  }

  // ============================================================================
  // Webhook Processing
  // ============================================================================

  async verifyWebhookSignature(
    integrationId: string,
    payload: string,
    signature: string,
  ): Promise<boolean> {
    const storedIntegration = await this.getIntegration(integrationId);
    if (!storedIntegration || !storedIntegration.webhookSecret) {
      return false;
    }

    const expectedSignature = createHmac(
      'sha256',
      storedIntegration.webhookSecret,
    )
      .update(payload)
      .digest('hex');

    return (
      signature === expectedSignature ||
      signature === `sha256=${expectedSignature}`
    );
  }

  async getDecryptedAccessToken(integrationId: string): Promise<string | null> {
    const storedIntegration = await this.getIntegration(integrationId);
    if (!storedIntegration || !storedIntegration.accessToken) {
      return null;
    }

    return this.decrypt(storedIntegration.accessToken);
  }

  // ============================================================================
  // Encryption Helpers
  // ============================================================================

  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private mapToStoredIntegration(
    record: typeof integration.$inferSelect,
  ): StoredIntegration {
    return {
      id: record.id,
      workspaceId: record.workspaceId,
      type: record.type as IntegrationType,
      status: record.status as IntegrationStatus,
      name: record.name ?? undefined,
      description: record.description ?? undefined,
      externalAccountId: record.externalAccountId ?? undefined,
      externalAccountName: record.externalAccountName ?? undefined,
      scopes: record.scopes ?? undefined,
      webhookUrl: record.webhookUrl ?? undefined,
      webhookSecret: record.webhookSecret ?? undefined,
      accessToken: record.accessToken ?? undefined,
      refreshToken: record.refreshToken ?? undefined,
      tokenType: record.tokenType ?? undefined,
      tokenExpiresAt: record.tokenExpiresAt?.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      lastSyncAt: record.lastSyncAt?.toISOString(),
    };
  }
}
