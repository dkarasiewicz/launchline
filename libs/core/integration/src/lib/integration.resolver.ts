import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import {
  AuthenticatedUser,
  AuthenticatedWorkspace,
  CurrentUser,
  CurrentWorkspace,
} from '@launchline/core-common';
import { IntegrationService } from './integration.service';
import {
  Integration,
  IntegrationListResponse,
  IntegrationStatus,
  IntegrationType,
  OAuthStartResponse,
  StartOAuthInput,
  UpdateIntegrationInput,
  DeleteIntegrationInput,
  RefreshIntegrationTokenInput,
} from './integration.models';

@Resolver(() => Integration)
export class IntegrationResolver {
  private readonly logger = new Logger(IntegrationResolver.name);

  constructor(private readonly integrationService: IntegrationService) {}

  @Query(() => IntegrationListResponse)
  async integrations(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
  ): Promise<IntegrationListResponse> {
    this.logger.debug(`Listing integrations for workspace: ${workspace.id}`);

    const results = await this.integrationService.listIntegrations(
      workspace.id,
    );

    return {
      integrations: results.map((i) => ({
        id: i.id,
        workspaceId: i.workspaceId,
        type: i.type as IntegrationType,
        status: i.status as IntegrationStatus,
        name: i.name,
        description: i.description,
        externalAccountId: i.externalAccountId,
        externalAccountName: i.externalAccountName,
        scopes: i.scopes,
        webhookUrl: i.webhookUrl,
        // Don't expose webhook secret in GraphQL
        createdAt: new Date(i.createdAt),
        updatedAt: new Date(i.updatedAt),
        lastSyncAt: i.lastSyncAt ? new Date(i.lastSyncAt) : undefined,
        tokenExpiresAt: i.tokenExpiresAt
          ? new Date(i.tokenExpiresAt)
          : undefined,
      })),
    };
  }

  @Query(() => Integration, { nullable: true })
  async integration(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('integrationId') integrationId: string,
  ): Promise<Integration | null> {
    this.logger.debug(`Fetching integration: ${integrationId}`);

    const result = await this.integrationService.getIntegration(integrationId);

    if (!result || result.workspaceId !== workspace.id) {
      return null;
    }

    return {
      id: result.id,
      workspaceId: result.workspaceId,
      type: result.type as IntegrationType,
      status: result.status as IntegrationStatus,
      name: result.name,
      description: result.description,
      externalAccountId: result.externalAccountId,
      externalAccountName: result.externalAccountName,
      scopes: result.scopes,
      webhookUrl: result.webhookUrl,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
      lastSyncAt: result.lastSyncAt ? new Date(result.lastSyncAt) : undefined,
      tokenExpiresAt: result.tokenExpiresAt
        ? new Date(result.tokenExpiresAt)
        : undefined,
    };
  }

  // ============================================================================
  // Mutations
  // ============================================================================

  @Mutation(() => OAuthStartResponse)
  async startIntegrationOAuth(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: StartOAuthInput,
  ): Promise<OAuthStartResponse> {
    this.logger.debug(`Starting OAuth for ${input.type}`);

    const result = await this.integrationService.startOAuth(
      user.userId,
      input.type,
      input.redirectUrl,
    );

    return {
      authorizationUrl: result.authorizationUrl,
      state: result.state,
    };
  }

  @Mutation(() => Boolean)
  async updateIntegration(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('input') input: UpdateIntegrationInput,
  ): Promise<boolean> {
    this.logger.debug(`Updating integration: ${input.integrationId}`);

    // Verify ownership
    const existing = await this.integrationService.getIntegration(
      input.integrationId,
    );
    if (!existing || existing.workspaceId !== workspace.id) {
      throw new Error('Integration not found');
    }

    await this.integrationService.updateIntegration(input.integrationId, {
      name: input.name,
      description: input.description,
    });

    return true;
  }

  @Mutation(() => Boolean)
  async deleteIntegration(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('input') input: DeleteIntegrationInput,
  ): Promise<boolean> {
    this.logger.debug(`Deleting integration: ${input.integrationId}`);

    // Verify ownership
    const existing = await this.integrationService.getIntegration(
      input.integrationId,
    );
    if (!existing || existing.workspaceId !== workspace.id) {
      throw new Error('Integration not found');
    }

    await this.integrationService.deleteIntegration(input.integrationId);

    return true;
  }

  @Mutation(() => Boolean)
  async refreshIntegrationToken(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('input') input: RefreshIntegrationTokenInput,
  ): Promise<boolean> {
    this.logger.debug(
      `Refreshing token for integration: ${input.integrationId}`,
    );

    // Verify ownership
    const existing = await this.integrationService.getIntegration(
      input.integrationId,
    );
    if (!existing || existing.workspaceId !== workspace.id) {
      throw new Error('Integration not found');
    }

    await this.integrationService.refreshToken(input.integrationId);

    return true;
  }
}
