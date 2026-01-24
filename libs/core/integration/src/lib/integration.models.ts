import {
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export enum IntegrationType {
  LINEAR = 'linear',
  SLACK = 'slack',
  GITHUB = 'github',
  NOTION = 'notion',
  GOOGLE = 'google',
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
  LINEAR_ISSUE_CREATED = 'linear.issue.created',
  LINEAR_ISSUE_UPDATED = 'linear.issue.updated',
  LINEAR_COMMENT_CREATED = 'linear.comment.created',

  SLACK_MESSAGE_POSTED = 'slack.message.posted',
  SLACK_REACTION_ADDED = 'slack.reaction.added',

  GITHUB_PR_OPENED = 'github.pr.opened',
  GITHUB_PR_MERGED = 'github.pr.merged',
  GITHUB_ISSUE_OPENED = 'github.issue.opened',
  GITHUB_PUSH = 'github.push',
}

registerEnumType(WebhookEventType, {
  name: 'WebhookEventType',
  description: 'The type of webhook event',
});

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

  @Field({ nullable: true })
  externalOrganizationId?: string;

  @Field({ nullable: true })
  externalOrganizationName?: string;

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

export interface OAuthState {
  workspaceId: string;
  userId: string;
  type: IntegrationType;
  redirectUrl?: string;
  nonce: string;
  state: string;
  createdAt: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: Date;
  scope?: string;
  idToken?: string;
}
