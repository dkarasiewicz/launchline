import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Headers,
  Session,
  HttpCode,
  HttpStatus,
  Logger,
  VERSION_NEUTRAL,
  RawBodyRequest,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  AuthenticatedUser,
  AuthenticatedWorkspace,
  CurrentUser,
  CurrentWorkspace,
  Public,
} from '@launchline/core-common';
import { IntegrationOAuthService } from './integration.oauth.service';
import { IntegrationWebhookService } from './integration.webhook.service';
import { IntegrationType, OAuthState } from './integration.models';
import { randomBytes } from 'crypto';

interface OAuthSessionData {
  oauthState?: string;
  oauthRedirectUrl?: string;
}

@Controller({ version: VERSION_NEUTRAL, path: 'integrations' })
export class IntegrationController {
  private readonly logger = new Logger(IntegrationController.name);

  constructor(
    private readonly oauthService: IntegrationOAuthService,
    private readonly webhookService: IntegrationWebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Get('oauth/linear/init')
  async linearOAuthInit(
    @Query('redirect_url') redirectUrl: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Session() session: OAuthSessionData,
    @Res() res: Response,
  ) {
    this.logger.debug(
      { userId: user.userId, workspaceId: workspace.id },
      'Starting Linear OAuth flow',
    );

    const frontendUrl = this.configService.get<string>('frontendUrl');

    try {
      const state = randomBytes(32).toString('hex');
      const nonce = randomBytes(16).toString('hex');

      const { authorizationUrl } = await this.oauthService.startLinearOAuth(
        user.userId,
        state,
      );

      const oauthState: OAuthState = {
        workspaceId: workspace.id,
        userId: user.userId,
        type: IntegrationType.LINEAR,
        redirectUrl,
        nonce,
        state,
        createdAt: new Date().toISOString(),
      };

      session.oauthState = JSON.stringify(oauthState);
      session.oauthRedirectUrl = redirectUrl;
      this.logger.debug(
        { userId: user.userId, workspaceId: workspace.id },
        'Redirecting to Linear OAuth',
      );

      return res.redirect(authorizationUrl);
    } catch (err) {
      this.logger.error({ err }, 'Linear OAuth init error');

      return res.redirect(
        `${frontendUrl}/settings/integrations?error=oauth_init_failed&error_description=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`,
      );
    }
  }

  @Get('oauth/slack/init')
  async slackOAuthInit(
    @Query('redirect_url') redirectUrl: string | undefined,
    @Query('team') teamId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Session() session: OAuthSessionData,
    @Res() res: Response,
  ) {
    this.logger.debug(
      { userId: user.userId, workspaceId: workspace.id },
      'Starting Slack OAuth flow',
    );

    const frontendUrl = this.configService.get<string>('frontendUrl');

    try {
      const state = randomBytes(32).toString('hex');
      const nonce = randomBytes(16).toString('hex');

      const { authorizationUrl } = await this.oauthService.startSlackOAuth(
        user.userId,
        state,
        teamId,
      );

      const oauthState: OAuthState = {
        workspaceId: workspace.id,
        userId: user.userId,
        type: IntegrationType.SLACK,
        redirectUrl,
        nonce,
        state,
        createdAt: new Date().toISOString(),
      };

      session.oauthState = JSON.stringify(oauthState);
      session.oauthRedirectUrl = redirectUrl;

      return res.redirect(authorizationUrl);
    } catch (err) {
      this.logger.error({ err }, 'Slack OAuth init error');

      return res.redirect(
        `${frontendUrl}/settings/integrations?error=oauth_init_failed&error_description=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`,
      );
    }
  }

  @Get('oauth/google/init')
  async googleOAuthInit(
    @Query('redirect_url') redirectUrl: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Session() session: OAuthSessionData,
    @Res() res: Response,
  ) {
    this.logger.debug(
      { userId: user.userId, workspaceId: workspace.id },
      'Starting Google OAuth flow',
    );

    const frontendUrl = this.configService.get<string>('frontendUrl');

    try {
      const state = randomBytes(32).toString('hex');
      const nonce = randomBytes(16).toString('hex');

      const { authorizationUrl } = await this.oauthService.startGoogleOAuth(
        user.userId,
        state,
      );

      const oauthState: OAuthState = {
        workspaceId: workspace.id,
        userId: user.userId,
        type: IntegrationType.GOOGLE,
        redirectUrl,
        nonce,
        state,
        createdAt: new Date().toISOString(),
      };

      session.oauthState = JSON.stringify(oauthState);
      session.oauthRedirectUrl = redirectUrl;

      return res.redirect(authorizationUrl);
    } catch (err) {
      this.logger.error({ err }, 'Google OAuth init error');

      return res.redirect(
        `${frontendUrl}/settings/integrations?error=oauth_init_failed&error_description=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`,
      );
    }
  }

  @Get('oauth/github/init')
  async githubOAuthInit(
    @Query('redirect_url') redirectUrl: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Session() session: OAuthSessionData,
    @Res() res: Response,
  ) {
    this.logger.debug(
      { userId: user.userId, workspaceId: workspace.id },
      'Starting GitHub OAuth flow',
    );

    const frontendUrl = this.configService.get<string>('frontendUrl');

    try {
      const state = randomBytes(32).toString('hex');
      const nonce = randomBytes(16).toString('hex');

      const { authorizationUrl } = await this.oauthService.startGitHubOAuth(
        user.userId,
        state,
      );

      const oauthState: OAuthState = {
        workspaceId: workspace.id,
        userId: user.userId,
        type: IntegrationType.GITHUB,
        redirectUrl,
        nonce,
        state,
        createdAt: new Date().toISOString(),
      };

      session.oauthState = JSON.stringify(oauthState);
      session.oauthRedirectUrl = redirectUrl;

      return res.redirect(authorizationUrl);
    } catch (err) {
      this.logger.error({ err }, 'GitHub OAuth init error');

      return res.redirect(
        `${frontendUrl}/settings/integrations?error=oauth_init_failed&error_description=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`,
      );
    }
  }

  @Get('oauth/linear/callback')
  async linearOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Session() session: OAuthSessionData,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const redirectUrl =
      session.oauthRedirectUrl || `${frontendUrl}/settings/integrations`;

    const clearSession = () => {
      delete session.oauthState;
      delete session.oauthRedirectUrl;
    };

    if (error) {
      this.logger.error(
        {
          error,
          errorDescription,
        },
        'Linear OAuth error',
      );

      clearSession();

      return res.redirect(
        `${redirectUrl}?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`,
      );
    }

    if (!code || !state) {
      this.logger.error(
        { hasCode: Boolean(code), hasState: Boolean(state) },
        'Linear OAuth callback missing code or state',
      );

      clearSession();

      return res.redirect(`${redirectUrl}?error=missing_params`);
    }

    const oauthState = JSON.parse(session.oauthState || '{}') as OAuthState;

    if (oauthState.state !== state) {
      this.logger.error(
        { stateFromQuery: state, stateFromSession: oauthState.state },
        'Linear OAuth state mismatch',
      );

      clearSession();

      return res.redirect(`${redirectUrl}?error=invalid_state`);
    }

    try {
      const { integrationId } = await this.oauthService.completeLinearOAuth(
        code,
        oauthState,
      );

      clearSession();

      this.logger.log(
        { integrationId, workspaceId: oauthState.workspaceId },
        'Linear OAuth completed',
      );

      return res.redirect(
        `${redirectUrl}?integration_id=${integrationId}&success=true`,
      );
    } catch (err) {
      this.logger.error({ err }, 'Linear OAuth callback error');

      clearSession();

      return res.redirect(
        `${redirectUrl}?error=oauth_failed&error_description=could_not_complete_oauth`,
      );
    }
  }

  @Get('oauth/slack/callback')
  async slackOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Session() session: OAuthSessionData,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const redirectUrl =
      session.oauthRedirectUrl || `${frontendUrl}/settings/integrations`;

    const clearSession = () => {
      delete session.oauthState;
      delete session.oauthRedirectUrl;
    };

    if (error) {
      this.logger.error({ error, errorDescription }, 'Slack OAuth error');
      clearSession();
      return res.redirect(
        `${redirectUrl}?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`,
      );
    }

    if (!code || !state) {
      this.logger.error(
        { hasCode: Boolean(code), hasState: Boolean(state) },
        'Slack OAuth callback missing code or state',
      );
      clearSession();
      return res.redirect(`${redirectUrl}?error=missing_params`);
    }

    const oauthState = JSON.parse(session.oauthState || '{}') as OAuthState;

    if (oauthState.state !== state) {
      this.logger.error(
        { stateFromQuery: state, stateFromSession: oauthState.state },
        'Slack OAuth state mismatch',
      );
      clearSession();
      return res.redirect(`${redirectUrl}?error=invalid_state`);
    }

    try {
      const { integrationId } = await this.oauthService.completeSlackOAuth(
        code,
        oauthState,
      );

      clearSession();

      this.logger.log(
        { integrationId, workspaceId: oauthState.workspaceId },
        'Slack OAuth completed',
      );

      return res.redirect(
        `${redirectUrl}?integration_id=${integrationId}&success=true`,
      );
    } catch (err) {
      this.logger.error({ err }, 'Slack OAuth callback error');
      clearSession();
      return res.redirect(
        `${redirectUrl}?error=oauth_failed&error_description=could_not_complete_oauth`,
      );
    }
  }

  @Get('oauth/google/callback')
  async googleOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Session() session: OAuthSessionData,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const redirectUrl =
      session.oauthRedirectUrl || `${frontendUrl}/settings/integrations`;

    const clearSession = () => {
      delete session.oauthState;
      delete session.oauthRedirectUrl;
    };

    if (error) {
      this.logger.error({ error, errorDescription }, 'Google OAuth error');

      clearSession();

      return res.redirect(
        `${redirectUrl}?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`,
      );
    }

    if (!code || !state) {
      this.logger.error(
        { hasCode: Boolean(code), hasState: Boolean(state) },
        'Google OAuth callback missing code or state',
      );

      clearSession();

      return res.redirect(`${redirectUrl}?error=missing_params`);
    }

    const oauthState = JSON.parse(session.oauthState || '{}') as OAuthState;

    if (oauthState.state !== state) {
      this.logger.error(
        { stateFromQuery: state, stateFromSession: oauthState.state },
        'Google OAuth state mismatch',
      );

      clearSession();

      return res.redirect(`${redirectUrl}?error=invalid_state`);
    }

    try {
      const { integrationId } = await this.oauthService.completeGoogleOAuth(
        code,
        oauthState,
      );

      clearSession();

      this.logger.log(
        { integrationId, workspaceId: oauthState.workspaceId },
        'Google OAuth completed',
      );

      return res.redirect(
        `${redirectUrl}?integration_id=${integrationId}&success=true`,
      );
    } catch (err) {
      this.logger.error({ err }, 'Google OAuth callback error');

      clearSession();

      return res.redirect(
        `${redirectUrl}?error=oauth_failed&error_description=could_not_complete_oauth`,
      );
    }
  }

  @Get('oauth/github/callback')
  async githubOAuthCallback(
    @Query('code') code: string,
    @Query('installation_id') installationId: string,
    @Query('setup_action') setupAction: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Session() session: OAuthSessionData,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const redirectUrl =
      session.oauthRedirectUrl || `${frontendUrl}/settings/integrations`;

    const clearSession = () => {
      delete session.oauthState;
      delete session.oauthRedirectUrl;
    };

    if (error) {
      this.logger.error({ error, errorDescription }, 'GitHub OAuth error');

      clearSession();

      return res.redirect(
        `${redirectUrl}?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`,
      );
    }

    const oauthState = JSON.parse(session.oauthState || '{}') as OAuthState;

    if (oauthState.state !== state) {
      this.logger.error(
        { stateFromQuery: state, stateFromSession: oauthState.state },
        'GitHub OAuth state mismatch',
      );

      clearSession();

      return res.redirect(`${redirectUrl}?error=invalid_state`);
    }

    try {
      let integrationId: string;

      if (installationId) {
        const result = await this.oauthService.completeGitHubAppInstall(
          installationId,
          oauthState,
        );
        integrationId = result.integrationId;
      } else {
        if (!code) {
          this.logger.error(
            { hasCode: Boolean(code), hasState: Boolean(state), setupAction },
            'GitHub OAuth callback missing code or installation id',
          );

          clearSession();

          return res.redirect(`${redirectUrl}?error=missing_params`);
        }

        const result = await this.oauthService.completeGitHubOAuth(
          code,
          oauthState,
        );
        integrationId = result.integrationId;
      }

      clearSession();

      this.logger.log(
        { integrationId, workspaceId: oauthState.workspaceId },
        'GitHub integration completed',
      );

      return res.redirect(
        `${redirectUrl}?integration_id=${integrationId}&success=true`,
      );
    } catch (err) {
      this.logger.error({ err }, 'GitHub OAuth callback error');

      clearSession();

      return res.redirect(
        `${redirectUrl}?error=oauth_failed&error_description=could_not_complete_oauth`,
      );
    }
  }

  @Public()
  @Post('webhooks/linear')
  @HttpCode(HttpStatus.OK)
  async linearWebhook(
    @Headers('linear-signature') signature: string,
    @Headers('linear-delivery') deliveryId: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.debug(
      { deliveryId, signaturePresent: Boolean(signature) },
      'Received Linear webhook',
    );

    const rawBody = req.rawBody?.toString();

    if (!rawBody) {
      this.logger.warn(
        { deliveryId },
        'Linear webhook received without raw body',
      );

      return { received: false, error: 'missing_body' };
    }

    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      this.logger.error({ deliveryId }, 'Failed to parse Linear webhook payload');

      return { received: false, error: 'invalid_json' };
    }

    const eventType = payload['type'] as string;
    const action = payload['action'] as string;

    this.logger.debug(
      { eventType, action },
      'Linear webhook event received',
    );

    try {
      const result = await this.webhookService.processLinearWebhook(
        payload,
        rawBody,
        signature,
      );

      return {
        received: true,
        processed: result.processed,
        integrationId: result.integrationId,
      };
    } catch (err) {
      this.logger.error({ err }, 'Failed to process Linear webhook');

      return { received: true, processed: false, error: 'processing_failed' };
    }
  }

  @Public()
  @Post('webhooks/github')
  @HttpCode(HttpStatus.OK)
  async githubWebhook(
    @Query('integrationId') integrationId: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') eventType: string | undefined,
    @Headers('x-github-delivery') deliveryId: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody?.toString() || '';
    const payload = req.body as Record<string, unknown>;

    try {
      const result = await this.webhookService.processGitHubWebhook({
        integrationId,
        payload,
        rawBody,
        signature,
        eventType,
        deliveryId,
      });

      return {
        received: true,
        processed: result.processed,
        integrationId: result.integrationId,
      };
    } catch (err) {
      this.logger.error({ err }, 'Failed to process GitHub webhook');
      return { received: true, processed: false, error: 'processing_failed' };
    }
  }
}
