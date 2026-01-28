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
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  AuthenticatedUser,
  CurrentUser,
  Public,
  EventBusService,
  DB_CONNECTION,
  integration,
} from '@launchline/core-common';
import { IntegrationService } from './integration.service';
import { IntegrationType } from './integration.models';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { createHmac } from 'crypto';

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
    private readonly eventBusService: EventBusService,
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
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
      const frontendUrl = this.configService.get<string>('app.frontendUrl');
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
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
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
    this.logger.log(`Processing ${type} webhook`, {
      payloadKeys: Object.keys(payload),
      hasSignature: !!signature,
    });

    // Find the integration by type
    // For Linear, we look for the first active Linear integration
    // In a multi-tenant setup, you might need to identify the workspace from the webhook
    const [integrationRecord] = await this.db
      .select()
      .from(integration)
      .where(eq(integration.type, type))
      .limit(1);

    if (!integrationRecord) {
      this.logger.warn(`No ${type} integration found for webhook`);
      return { received: true }; // Return 200 to avoid retries
    }

    // Verify webhook signature
    if (signature && integrationRecord.webhookSecret) {
      const isValid = await this.verifyWebhookSignature(
        type,
        rawBody,
        signature,
        integrationRecord.webhookSecret,
      );

      if (!isValid) {
        this.logger.error(`Invalid webhook signature for ${type}`);
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    // Publish webhook event to RabbitMQ for async processing
    await this.eventBusService.publish({
      id: `webhook-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      version: 'V1' as any,
      eventType: 'INTEGRATION_WEBHOOK_RECEIVED' as any,
      origin: 'INTEGRATION' as any,
      payload: {
        integrationId: integrationRecord.id,
        workspaceId: integrationRecord.workspaceId,
        integrationType: type,
        webhookPayload: payload,
        receivedAt: new Date().toISOString(),
      } as any,
    } as any);

    this.logger.debug(`Published ${type} webhook to event bus`);

    return { received: true };
  }

  private async verifyWebhookSignature(
    type: IntegrationType,
    rawBody: string,
    signature: string,
    webhookSecret: string,
  ): Promise<boolean> {
    switch (type) {
      case IntegrationType.LINEAR: {
        // Linear uses HMAC SHA256
        const expectedSignature = createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');
        return signature === expectedSignature;
      }

      case IntegrationType.SLACK: {
        // Slack signature verification is more complex (involves timestamp)
        // For now, basic HMAC check
        const expectedSignature = createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');
        return signature.includes(expectedSignature);
      }

      case IntegrationType.GITHUB: {
        // GitHub uses sha256=<signature>
        const expectedSignature =
          'sha256=' +
          createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
        return signature === expectedSignature;
      }

      default:
        return false;
    }
  }
}
