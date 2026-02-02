import {
  Inject,
  Injectable,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from 'crypto';
import {
  IntegrationType,
  IntegrationStatus,
  Integration,
} from './integration.models';
import { DB_CONNECTION, integration } from '@launchline/core-common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { LinearService } from './linear.service';
import { GoogleService } from './google.service';

interface CreateIntegrationInput {
  integrationId?: string;
  workspaceId: string;
  type: IntegrationType;
  status: IntegrationStatus;
  name?: string;
  description?: string;
  externalAccountId?: string;
  externalAccountName?: string;
  externalOrganizationId?: string;
  externalOrganizationName?: string;
  scopes?: string[];
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly configService: ConfigService,
    private readonly linearService: LinearService,
    private readonly googleService: GoogleService,
  ) {
    this.encryptionKey = Buffer.from(
      this.configService.get('integrations.encryptionKey') as string,
      'hex',
    );
  }

  async createIntegration(input: CreateIntegrationInput): Promise<string> {
    const integrationId = input.integrationId || randomUUID();
    const now = new Date();

    await this.db.insert(integration).values({
      id: integrationId,
      workspaceId: input.workspaceId,
      type: input.type,
      status: input.status,
      name: input.name,
      description: input.description,
      externalAccountId: input.externalAccountId,
      externalAccountName: input.externalAccountName,
      externalOrganizationId: input.externalOrganizationId,
      externalOrganizationName: input.externalOrganizationName,
      scopes: input.scopes ? JSON.stringify(input.scopes) : null,
      accessToken: input.accessToken ? this.encrypt(input.accessToken) : null,
      refreshToken: input.refreshToken
        ? this.encrypt(input.refreshToken)
        : null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      createdAt: now,
      updatedAt: now,
    } satisfies typeof integration.$inferInsert);

    this.logger.log(
      { integrationId, workspaceId: input.workspaceId, type: input.type },
      'Created integration record',
    );

    return integrationId;
  }

  async listIntegrations(workspaceId: string): Promise<Integration[]> {
    const results = await this.db
      .select()
      .from(integration)
      .where(eq(integration.workspaceId, workspaceId));

    return results.map((r) => this.mapToStoredIntegration(r));
  }

  async getIntegration(integrationId: string): Promise<Integration | null> {
    const [result] = await this.db
      .select()
      .from(integration)
      .where(eq(integration.id, integrationId));

    if (!result) return null;

    return this.mapToStoredIntegration(result);
  }

  async getIntegrationsByType(
    workspaceId: string,
    type: IntegrationType,
  ): Promise<Integration[]> {
    const results = await this.db
      .select()
      .from(integration)
      .where(
        and(
          eq(integration.workspaceId, workspaceId),
          eq(integration.type, type),
        ),
      );

    return results.map((r) => this.mapToStoredIntegration(r));
  }

  async getIntegrationByExternalAccountId(
    type: IntegrationType,
    externalAccountId: string,
  ): Promise<Integration | null> {
    const [result] = await this.db
      .select()
      .from(integration)
      .where(
        and(
          eq(integration.type, type),
          eq(integration.externalAccountId, externalAccountId),
          eq(integration.status, IntegrationStatus.ACTIVE),
        ),
      );

    if (!result) {
      return null;
    }

    return this.mapToStoredIntegration(result);
  }

  async getActiveIntegrationByExternalOrganization(
    type: IntegrationType,
    externalOrganizationId: string,
  ): Promise<Integration | null> {
    const [result] = await this.db
      .select()
      .from(integration)
      .where(
        and(
          eq(integration.type, type),
          eq(integration.externalOrganizationId, externalOrganizationId),
          eq(integration.status, IntegrationStatus.ACTIVE),
        ),
      );

    if (!result) {
      return null;
    }

    return this.mapToStoredIntegration(result);
  }

  async deleteIntegration(integrationId: string): Promise<void> {
    await this.db.delete(integration).where(eq(integration.id, integrationId));

    this.logger.log({ integrationId }, 'Deleted integration record');
  }

  async getDecryptedAccessToken(integrationId: string): Promise<string | null> {
    const [result] = await this.db
      .select()
      .from(integration)
      .where(eq(integration.id, integrationId));

    if (!result?.accessToken) {
      return null;
    }

    if (
      result.tokenExpiresAt &&
      result.tokenExpiresAt < new Date() &&
      result.refreshToken
    ) {
      switch (result.type) {
        case IntegrationType.LINEAR: {
          const newToken = await this.linearService.refreshAccessToken(
            integrationId,
            this.decrypt(result.refreshToken),
          );

          await this.db
            .update(integration)
            .set({
              accessToken: this.encrypt(newToken.accessToken),
              refreshToken: this.encrypt(newToken.refreshToken),
              tokenExpiresAt: newToken.tokenExpiresAt,
            })
            .where(eq(integration.id, integrationId));

          return newToken.accessToken;
        }
        case IntegrationType.GOOGLE: {
          const newToken = await this.googleService.refreshAccessToken(
            this.decrypt(result.refreshToken),
          );

          await this.db
            .update(integration)
            .set({
              accessToken: this.encrypt(newToken.accessToken),
              refreshToken: this.encrypt(newToken.refreshToken),
              tokenExpiresAt: newToken.tokenExpiresAt,
            })
            .where(eq(integration.id, integrationId));

          return newToken.accessToken;
        }

        default:
          throw new NotImplementedException(
            'Token refresh not implemented for this integration type',
          );
      }
    }

    return this.decrypt(result.accessToken);
  }

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

  private mapToStoredIntegration(
    record: typeof integration.$inferSelect,
  ): Integration {
    return {
      id: record.id,
      workspaceId: record.workspaceId,
      type: record.type as IntegrationType,
      status: record.status as IntegrationStatus,
      name: record.name ?? undefined,
      description: record.description ?? undefined,
      externalAccountId: record.externalAccountId ?? undefined,
      externalAccountName: record.externalAccountName ?? undefined,
      externalOrganizationId: record.externalOrganizationId ?? undefined,
      externalOrganizationName: record.externalOrganizationName ?? undefined,
      scopes: record.scopes ? JSON.parse(record.scopes) : undefined,
      tokenExpiresAt: record.tokenExpiresAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastSyncAt: record.lastSyncAt ?? undefined,
    };
  }
}
