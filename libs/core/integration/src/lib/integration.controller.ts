import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  Res,
  Headers,
  Session,
  HttpCode,
  HttpStatus,
  Logger,
  VERSION_NEUTRAL,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  AuthenticatedUser,
  CurrentUser,
  Public,
} from '@launchline/core-common';
import { IntegrationService } from './integration.service';
import { IntegrationType } from './integration.models';

interface OAuthSessionData {
  oauthState?: string;
  oauthType?: IntegrationType;
  oauthRedirectUrl?: string;
  oauthWorkspaceId?: string;
  oauthUserId?: string;
}

@Controller({ version: VERSION_NEUTRAL, path: 'integrations' })
export class IntegrationController {
  private readonly logger = new Logger(IntegrationController.name);

  constructor(
    private readonly integrationService: IntegrationService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================================================
  // OAuth Endpoints
  // ============================================================================

  /**
   * Start OAuth flow for a specific integration type
   * Stores OAuth state in session for security
   */
  @Get('oauth/:type/init')
  async oauthInit(
    @Param('type') type: string,
    @Query('redirect_url') redirectUrl: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Session() session: OAuthSessionData,
    @Res() res: Response,
  ) {
    // Validate integration type
    const integrationType = this.validateIntegrationType(type);
    if (!integrationType) {
      throw new BadRequestException(`Invalid integration type: ${type}`);
    }

    this.logger.debug(`Starting OAuth flow for ${integrationType}`);

    try {
      // Start OAuth and get authorization URL
      const { authorizationUrl, state, workspaceId } =
        await this.integrationService.startOAuth(
          user.userId,
          integrationType,
          redirectUrl,
        );

      // Store OAuth state in session for verification during callback
      session.oauthState = state;
      session.oauthType = integrationType;
      session.oauthRedirectUrl = redirectUrl;
      session.oauthWorkspaceId = workspaceId;
      session.oauthUserId = user.userId;

      this.logger.debug(`Redirecting to OAuth provider for ${integrationType}`);

      // Redirect to OAuth provider
      return res.redirect(authorizationUrl);
    } catch (err) {
      this.logger.error(`OAuth init error: ${err}`);
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:4200';
      return res.redirect(
        `${frontendUrl}/settings/integrations?error=oauth_init_failed&error_description=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`,
      );
    }
  }

  /**
   * OAuth callback endpoint - handles the redirect from OAuth providers
   * Validates state from session for CSRF protection
   */
  @Public()
  @Get('oauth/:type/callback')
  async oauthCallback(
    @Param('type') type: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Session() session: OAuthSessionData,
    @Res() res: Response,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';
    const redirectUrl =
      session.oauthRedirectUrl || `${frontendUrl}/settings/integrations`;

    // Clear OAuth session data after use
    const clearSession = () => {
      delete session.oauthState;
      delete session.oauthType;
      delete session.oauthRedirectUrl;
      delete session.oauthWorkspaceId;
      delete session.oauthUserId;
    };

    if (error) {
      this.logger.error(`OAuth error: ${error} - ${errorDescription}`);
      clearSession();
      return res.redirect(
        `${redirectUrl}?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`,
      );
    }

    if (!code || !state) {
      clearSession();
      return res.redirect(`${redirectUrl}?error=missing_params`);
    }

    // Validate state from session (CSRF protection)
    if (!session.oauthState || session.oauthState !== state) {
      this.logger.error('OAuth state mismatch - possible CSRF attack');
      clearSession();
      return res.redirect(`${redirectUrl}?error=invalid_state`);
    }

    // Validate integration type matches
    const integrationType = this.validateIntegrationType(type);
    if (!integrationType || session.oauthType !== integrationType) {
      this.logger.error('OAuth type mismatch');
      clearSession();
      return res.redirect(`${redirectUrl}?error=type_mismatch`);
    }

    try {
      const { integrationId } = await this.integrationService.completeOAuth(
        code,
        state,
      );

      clearSession();
      return res.redirect(
        `${redirectUrl}?integration_id=${integrationId}&success=true`,
      );
    } catch (err) {
      this.logger.error(`OAuth callback error: ${err}`);
      clearSession();
      return res.redirect(
        `${redirectUrl}?error=oauth_failed&error_description=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`,
      );
    }
  }

  // ============================================================================
  // Webhook Endpoints
  // ============================================================================

  /**
   * Linear webhook endpoint
   */
  @Public()
  @Post('webhooks/linear')
  @HttpCode(HttpStatus.OK)
  async linearWebhook(
    @Headers('linear-signature') signature: string,
    @Headers('linear-delivery') deliveryId: string,
    @Body() payload: Record<string, unknown>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.debug(`Received Linear webhook: ${deliveryId}`);

    const rawBody = req.rawBody?.toString() || JSON.stringify(payload);

    return this.processWebhook(
      IntegrationType.LINEAR,
      payload,
      rawBody,
      signature,
    );
  }

  /**
   * Slack webhook endpoint
   */
  @Public()
  @Post('webhooks/slack')
  @HttpCode(HttpStatus.OK)
  async slackWebhook(
    @Headers('x-slack-signature') signature: string,
    @Headers('x-slack-request-timestamp') timestamp: string,
    @Body() payload: Record<string, unknown>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.debug('Received Slack webhook');

    // Handle Slack URL verification challenge
    if (payload['type'] === 'url_verification') {
      return { challenge: payload['challenge'] };
    }

    const rawBody = req.rawBody?.toString() || JSON.stringify(payload);

    return this.processWebhook(
      IntegrationType.SLACK,
      payload,
      rawBody,
      signature,
    );
  }

  /**
   * GitHub webhook endpoint
   */
  @Public()
  @Post('webhooks/github')
  @HttpCode(HttpStatus.OK)
  async githubWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Headers('x-github-event') eventType: string,
    @Body() payload: Record<string, unknown>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.debug(`Received GitHub webhook: ${eventType} - ${deliveryId}`);

    const rawBody = req.rawBody?.toString() || JSON.stringify(payload);

    return this.processWebhook(
      IntegrationType.GITHUB,
      { ...payload, __eventType: eventType },
      rawBody,
      signature,
    );
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private validateIntegrationType(type: string): IntegrationType | null {
    const validTypes = Object.values(IntegrationType);
    const normalizedType = type.toLowerCase();

    if (validTypes.includes(normalizedType as IntegrationType)) {
      return normalizedType as IntegrationType;
    }
    return null;
  }

  private async processWebhook(
    type: IntegrationType,
    payload: Record<string, unknown>,
    rawBody: string,
    signature?: string,
  ): Promise<{ received: boolean }> {
    // In a real implementation, you would:
    // 1. Find the integration by type/workspace
    // 2. Verify the webhook signature
    // 3. Store the webhook delivery for processing
    // 4. Publish an event to RabbitMQ for async processing

    this.logger.log(`Processing ${type} webhook`, {
      payloadKeys: Object.keys(payload),
      hasSignature: !!signature,
    });

    // For now, just acknowledge receipt
    return { received: true };
  }
}
