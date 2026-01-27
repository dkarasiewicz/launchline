import {
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

// ============================================================================
// Enums
// ============================================================================

export enum IntegrationType {
  LINEAR = 'linear',
  SLACK = 'slack',
  GITHUB = 'github',
  JIRA = 'jira',
  NOTION = 'notion',
}

registerEnumType(IntegrationType, {
  name: 'IntegrationType',
  description: 'The type of integration',
});

export enum IntegrationStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  ERROR = 'error',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

registerEnumType(IntegrationStatus, {
  name: 'IntegrationStatus',
  description: 'The status of an integration',
});

export enum WebhookEventType {
  // Linear events
  LINEAR_ISSUE_CREATED = 'linear.issue.created',
  LINEAR_ISSUE_UPDATED = 'linear.issue.updated',
  LINEAR_COMMENT_CREATED = 'linear.comment.created',

  // Slack events
  SLACK_MESSAGE_POSTED = 'slack.message.posted',
  SLACK_REACTION_ADDED = 'slack.reaction.added',

  // GitHub events
  GITHUB_PR_OPENED = 'github.pr.opened',
  GITHUB_PR_MERGED = 'github.pr.merged',
  GITHUB_ISSUE_OPENED = 'github.issue.opened',
  GITHUB_PUSH = 'github.push',

  // Jira events
  JIRA_ISSUE_CREATED = 'jira.issue.created',
  JIRA_ISSUE_UPDATED = 'jira.issue.updated',
}

registerEnumType(WebhookEventType, {
  name: 'WebhookEventType',
  description: 'The type of webhook event',
});

// ============================================================================
// GraphQL Object Types
// ============================================================================

@ObjectType()
export class Integration {
  @Field()
  id!: string;

  @Field()
  workspaceId!: string;

  @Field(() => IntegrationType)
  type!: IntegrationType;

  @Field(() => IntegrationStatus)
  status!: IntegrationStatus;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  externalAccountId?: string;

  @Field({ nullable: true })
  externalAccountName?: string;

  @Field(() => [String], { nullable: true })
  scopes?: string[];

  @Field({ nullable: true })
  webhookUrl?: string;

  @Field({ nullable: true })
  webhookSecret?: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  lastSyncAt?: Date;

  @Field(() => Date, { nullable: true })
  tokenExpiresAt?: Date;
}

@ObjectType()
export class IntegrationListResponse {
  @Field(() => [Integration])
  integrations!: Integration[];
}

@ObjectType()
export class OAuthStartResponse {
  @Field()
  authorizationUrl!: string;

  @Field()
  state!: string;
}

@ObjectType()
export class OAuthCallbackResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  integrationId?: string;

  @Field({ nullable: true })
  error?: string;
}

@ObjectType()
export class WebhookDelivery {
  @Field()
  id!: string;

  @Field()
  integrationId!: string;

  @Field(() => WebhookEventType)
  eventType!: WebhookEventType;

  @Field()
  payload!: string;

  @Field()
  success!: boolean;

  @Field({ nullable: true })
  errorMessage?: string;

  @Field(() => Date)
  receivedAt!: Date;

  @Field(() => Date, { nullable: true })
  processedAt?: Date;
}

// ============================================================================
// GraphQL Input Types
// ============================================================================

@InputType()
export class StartOAuthInput {
  @Field(() => IntegrationType)
  @IsEnum(IntegrationType)
  type!: IntegrationType;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  redirectUrl?: string;
}

@InputType()
export class CompleteOAuthInput {
  @Field()
  @IsString()
  code!: string;

  @Field()
  @IsString()
  state!: string;
}

@InputType()
export class UpdateIntegrationInput {
  @Field()
  @IsString()
  integrationId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType()
export class DeleteIntegrationInput {
  @Field()
  @IsString()
  integrationId!: string;
}

@InputType()
export class RefreshIntegrationTokenInput {
  @Field()
  @IsString()
  integrationId!: string;
}

// ============================================================================
// Internal Types (non-GraphQL)
// ============================================================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: Date;
  scope?: string;
  idToken?: string;
}

export interface IntegrationConfig {
  type: IntegrationType;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  webhookPath: string;
}

export interface WebhookPayload {
  type: string;
  action?: string;
  data: Record<string, unknown>;
  timestamp: string;
  signature?: string;
}

export interface StoredIntegration {
  id: string;
  workspaceId: string;
  type: IntegrationType;
  status: IntegrationStatus;
  name?: string;
  description?: string;
  externalAccountId?: string;
  externalAccountName?: string;
  scopes?: string[];
  webhookUrl?: string;
  webhookSecret?: string;
  // OAuth tokens (encrypted in storage)
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  tokenExpiresAt?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
}

export interface OAuthState {
  workspaceId: string;
  userId: string;
  type: IntegrationType;
  redirectUrl?: string;
  nonce: string;
  createdAt: string;
}
