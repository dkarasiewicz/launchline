import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import {
  AuthenticatedWorkspace,
  CurrentWorkspace,
  Roles,
} from '@launchline/core-common';
import { IntegrationService } from './integration.service';
import {
  DeleteIntegrationInput,
  Integration,
  IntegrationListResponse,
  IntegrationStatus,
  IntegrationType,
  UpdateIntegrationInput,
} from './integration.models';
import { UserRole } from '@launchline/models';

@Resolver(() => Integration)
export class IntegrationResolver {
  private readonly logger = new Logger(IntegrationResolver.name);

  constructor(private readonly integrationService: IntegrationService) {}

  @Roles(UserRole.WORKSPACE_ADMIN, UserRole.WORKSPACE_MEMBER)
  @Query(() => IntegrationListResponse)
  async integrations(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
  ): Promise<IntegrationListResponse> {
    this.logger.debug(
      { workspaceId: workspace.id },
      'Listing integrations for workspace',
    );

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
        externalOrganizationId: i.externalOrganizationId,
        externalOrganizationName: i.externalOrganizationName,
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

  @Roles(UserRole.WORKSPACE_ADMIN, UserRole.WORKSPACE_MEMBER)
  @Query(() => Integration, { nullable: true })
  async integration(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('integrationId') integrationId: string,
  ): Promise<Integration | null> {
    this.logger.debug(
      { integrationId, workspaceId: workspace.id },
      'Fetching integration',
    );

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
      externalOrganizationId: result.externalOrganizationId,
      externalOrganizationName: result.externalOrganizationName,
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

  @Roles(UserRole.WORKSPACE_ADMIN, UserRole.WORKSPACE_MEMBER)
  @Mutation(() => Boolean)
  async updateIntegration(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('input') input: UpdateIntegrationInput,
  ): Promise<boolean> {
    this.logger.debug(
      { integrationId: input.integrationId, workspaceId: workspace.id },
      'Updating integration',
    );

    // Verify ownership
    const existing = await this.integrationService.getIntegration(
      input.integrationId,
    );
    if (!existing || existing.workspaceId !== workspace.id) {
      throw new Error('Integration not found');
    }

    // TODO: update integration fields as needed

    return true;
  }

  @Roles(UserRole.WORKSPACE_ADMIN, UserRole.WORKSPACE_MEMBER)
  @Mutation(() => Boolean)
  async deleteIntegration(
    @CurrentWorkspace() workspace: AuthenticatedWorkspace,
    @Args('input') input: DeleteIntegrationInput,
  ): Promise<boolean> {
    this.logger.debug(
      { integrationId: input.integrationId, workspaceId: workspace.id },
      'Deleting integration',
    );

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
}
