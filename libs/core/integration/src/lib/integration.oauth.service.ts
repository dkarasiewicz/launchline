import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IntegrationConnectedEvent,
  EventBusService,
} from '@launchline/core-common';
import {
  IntegrationType,
  IntegrationStatus,
  OAuthState,
  OAuthTokens,
} from './integration.models';
import { IntegrationService } from './integration.service';
import { LinearService } from './linear.service';

@Injectable()
export class IntegrationOAuthService {
  private readonly logger = new Logger(IntegrationOAuthService.name);
  private readonly linearClientId: string | undefined = this.configService.get(
    'integrations.linear.clientId',
  );
  private readonly linearClientSecret: string | undefined =
    this.configService.get('integrations.linear.clientSecret');
  private readonly slackClientId: string | undefined = this.configService.get(
    'integrations.slack.clientId',
  );
  private readonly slackClientSecret: string | undefined =
    this.configService.get('integrations.slack.clientSecret');

  constructor(
    private readonly integrationService: IntegrationService,
    private readonly linearService: LinearService,
    private readonly configService: ConfigService,
    private readonly eventBusService: EventBusService,
  ) {}

  async startLinearOAuth(
    userId: string,
    state: string,
  ): Promise<{ authorizationUrl: string; state: string }> {
    if (!this.linearClientId) {
      throw new Error('Linear integration is not configured');
    }

    const appUrl = this.configService.get<string>('appUrl');
    const callbackUrl = `${appUrl}/integrations/oauth/linear/callback`;

    const params = new URLSearchParams({
      client_id: this.linearClientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'read,write,issues:create,comments:create',
      state,
      prompt: 'consent',
      actor: 'app',
    });

    const authorizationUrl = `https://linear.app/oauth/authorize?${params.toString()}`;

    this.logger.debug({ userId }, 'Started Linear OAuth flow');

    return { authorizationUrl, state };
  }

  async completeLinearOAuth(
    code: string,
    oauthState: OAuthState,
  ): Promise<{ integrationId: string; redirectUrl?: string }> {
    if (oauthState.type !== IntegrationType.LINEAR) {
      throw new Error('OAuth state type mismatch');
    }

    const tokens = await this.exchangeLinearCode(code);

    const [viewer, organization] = await Promise.all([
      this.linearService.getViewer(tokens.accessToken),
      this.linearService.getOrganization(tokens.accessToken),
    ]);

    const integrationId = await this.integrationService.createIntegration({
      workspaceId: oauthState.workspaceId,
      type: IntegrationType.LINEAR,
      status: IntegrationStatus.ACTIVE,
      name: `Linear - ${organization.name}`,
      externalAccountId: viewer.id,
      externalAccountName: viewer.name,
      externalOrganizationId: organization.id,
      externalOrganizationName: organization.name,
      scopes: ['read', 'write', 'issues:create', 'comments:create'],
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresAt ?? null,
    });

    this.logger.log(
      { integrationId, workspaceId: oauthState.workspaceId },
      'Completed Linear OAuth and created integration',
    );

    await this.eventBusService.publish(
      new IntegrationConnectedEvent(
        {
          integrationId,
          workspaceId: oauthState.workspaceId,
          userId: oauthState.userId,
          integrationType: IntegrationType.LINEAR,
          externalAccountId: viewer.id,
          externalAccountName: viewer.name,
          externalOrganizationId: organization.id,
          externalOrganizationName: organization.name,
          emittedAt: new Date().toISOString(),
        },
        oauthState.userId,
      ),
    );

    return { integrationId, redirectUrl: oauthState.redirectUrl };
  }

  async startSlackOAuth(
    userId: string,
    state: string,
  ): Promise<{ authorizationUrl: string; state: string }> {
    if (!this.slackClientId) {
      throw new Error('Slack integration is not configured');
    }

    const appUrl = this.configService.get<string>('appUrl');
    const callbackUrl = `${appUrl}/integrations/oauth/slack/callback`;

    const scopes = [
      'channels:read',
      'channels:history',
      'groups:read',
      'groups:history',
      'im:read',
      'im:history',
      'mpim:read',
      'mpim:history',
      'users:read',
      'users:read.email',
      'chat:write',
    ];

    const params = new URLSearchParams({
      client_id: this.slackClientId,
      redirect_uri: callbackUrl,
      scope: scopes.join(','),
      state,
    });

    const authorizationUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;

    this.logger.debug({ userId }, 'Started Slack OAuth flow');

    return { authorizationUrl, state };
  }

  async completeSlackOAuth(
    code: string,
    oauthState: OAuthState,
  ): Promise<{ integrationId: string; redirectUrl?: string }> {
    if (oauthState.type !== IntegrationType.SLACK) {
      throw new Error('OAuth state type mismatch');
    }

    const tokens = await this.exchangeSlackCode(code);

    const integrationId = await this.integrationService.createIntegration({
      workspaceId: oauthState.workspaceId,
      type: IntegrationType.SLACK,
      status: IntegrationStatus.ACTIVE,
      name: `Slack - ${tokens.teamName}`,
      externalAccountId: tokens.authedUserId,
      externalAccountName: tokens.authedUserId,
      externalOrganizationId: tokens.teamId,
      externalOrganizationName: tokens.teamName,
      scopes: tokens.scopes,
      accessToken: tokens.accessToken,
    });

    this.logger.log(
      { integrationId, workspaceId: oauthState.workspaceId },
      'Completed Slack OAuth and created integration',
    );

    await this.eventBusService.publish(
      new IntegrationConnectedEvent(
        {
          integrationId,
          workspaceId: oauthState.workspaceId,
          userId: oauthState.userId,
          integrationType: IntegrationType.SLACK,
          externalAccountId: tokens.authedUserId,
          externalAccountName: tokens.authedUserId,
          externalOrganizationId: tokens.teamId,
          externalOrganizationName: tokens.teamName,
          emittedAt: new Date().toISOString(),
        },
        oauthState.userId,
      ),
    );

    return { integrationId, redirectUrl: oauthState.redirectUrl };
  }

  private async exchangeLinearCode(code: string): Promise<OAuthTokens> {
    if (!this.linearClientId || !this.linearClientSecret) {
      throw new Error('Linear integration is not configured');
    }

    const appUrl = this.configService.get<string>('appUrl');
    const callbackUrl = `${appUrl}/integrations/oauth/linear/callback`;

    const response = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: this.linearClientId,
        client_secret: this.linearClientSecret,
        code,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();

      this.logger.error(
        { error },
        'Linear token exchange failed',
      );

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

  private async exchangeSlackCode(code: string): Promise<{
    accessToken: string;
    scopes: string[];
    teamId: string;
    teamName: string;
    authedUserId?: string;
  }> {
    if (!this.slackClientId || !this.slackClientSecret) {
      throw new Error('Slack integration is not configured');
    }

    const appUrl = this.configService.get<string>('appUrl');
    const callbackUrl = `${appUrl}/integrations/oauth/slack/callback`;

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: this.slackClientId,
        client_secret: this.slackClientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error }, 'Slack token exchange failed');
      throw new Error('Failed to exchange Slack authorization code');
    }

    const data = await response.json();

    if (!data.ok) {
      this.logger.error(
        { error: data.error },
        'Slack OAuth response error',
      );
      throw new Error('Slack OAuth failed');
    }

    if (!data.team?.id || !data.team?.name) {
      this.logger.error(
        { team: data.team },
        'Slack OAuth response missing team info',
      );
      throw new Error('Slack OAuth response missing team details');
    }

    return {
      accessToken: data.access_token,
      scopes: data.scope ? data.scope.split(',') : [],
      teamId: data.team.id,
      teamName: data.team.name,
      authedUserId: data.authed_user?.id,
    };
  }
}
