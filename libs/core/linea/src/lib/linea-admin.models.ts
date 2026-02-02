import {
  Field,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum LineaJobStatus {
  WAITING = 'waiting',
  DELAYED = 'delayed',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
  REPEATABLE = 'repeatable',
}

registerEnumType(LineaJobStatus, {
  name: 'LineaJobStatus',
  description: 'Linea job status',
});

@ObjectType()
export class LineaJob {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  type!: string;

  @Field(() => LineaJobStatus)
  status!: LineaJobStatus;

  @Field({ nullable: true })
  task?: string;

  @Field({ nullable: true })
  runAt?: Date;

  @Field({ nullable: true })
  nextRunAt?: Date;

  @Field({ nullable: true })
  cron?: string;

  @Field({ nullable: true })
  timezone?: string;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  lastRunAt?: Date;
}

@ObjectType()
export class LineaJobListResponse {
  @Field(() => [LineaJob])
  jobs!: LineaJob[];
}

@ObjectType()
export class LineaMemory {
  @Field()
  id!: string;

  @Field()
  namespace!: string;

  @Field()
  category!: string;

  @Field()
  summary!: string;

  @Field()
  content!: string;

  @Field()
  importance!: number;

  @Field({ nullable: true })
  updatedAt?: Date;

  @Field({ nullable: true })
  createdAt?: Date;
}

@ObjectType()
export class LineaMemoryListResponse {
  @Field(() => [LineaMemory])
  memories!: LineaMemory[];
}

@ObjectType()
export class LineaSkill {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  content!: string;

  @Field({ nullable: true })
  updatedAt?: Date;

  @Field({ nullable: true })
  createdAt?: Date;
}

@ObjectType()
export class LineaSkillListResponse {
  @Field(() => [LineaSkill])
  skills!: LineaSkill[];
}

@ObjectType()
export class LineaGraphNodeMetrics {
  @Field()
  connections!: number;

  @Field({ nullable: true })
  blockers?: number;

  @Field({ nullable: true })
  decisions?: number;

  @Field({ nullable: true })
  tickets?: number;

  @Field({ nullable: true })
  prs?: number;

  @Field({ nullable: true })
  projects?: number;
}

@ObjectType()
export class LineaGraphNode {
  @Field()
  id!: string;

  @Field()
  label!: string;

  @Field()
  type!: string;

  @Field(() => LineaGraphNodeMetrics, { nullable: true })
  metrics?: LineaGraphNodeMetrics;
}

@ObjectType()
export class LineaGraphEdge {
  @Field()
  source!: string;

  @Field()
  target!: string;

  @Field()
  type!: string;

  @Field({ nullable: true })
  weight?: number;
}

@ObjectType()
export class LineaTeamInsight {
  @Field()
  title!: string;

  @Field()
  detail!: string;

  @Field()
  level!: string;
}

@ObjectType()
export class LineaTeamGraph {
  @Field(() => [LineaGraphNode])
  nodes!: LineaGraphNode[];

  @Field(() => [LineaGraphEdge])
  edges!: LineaGraphEdge[];

  @Field(() => [LineaTeamInsight])
  insights!: LineaTeamInsight[];
}

@ObjectType()
export class LineaWorkspacePrompt {
  @Field()
  prompt!: string;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  updatedBy?: string;

  @Field()
  version!: number;
}

export enum LineaHeartbeatSummaryDelivery {
  INBOX = 'inbox',
  SLACK = 'slack',
  NONE = 'none',
}

registerEnumType(LineaHeartbeatSummaryDelivery, {
  name: 'LineaHeartbeatSummaryDelivery',
  description: 'Where heartbeat summaries should be delivered',
});

@ObjectType()
export class LineaHeartbeatSettings {
  @Field()
  enabled!: boolean;

  @Field(() => LineaHeartbeatSummaryDelivery)
  summaryDelivery!: LineaHeartbeatSummaryDelivery;

  @Field({ nullable: true })
  slackChannelId?: string;

  @Field({ nullable: true })
  quietHoursStart?: string;

  @Field({ nullable: true })
  quietHoursEnd?: string;

  @Field({ nullable: true })
  timezone?: string;

  @Field({ nullable: true })
  lastRunAt?: Date;

  @Field({ nullable: true })
  updatedAt?: Date;

  @Field({ nullable: true })
  updatedBy?: string;
}

@InputType()
export class UpdateLineaHeartbeatSettingsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Field(() => LineaHeartbeatSummaryDelivery, { nullable: true })
  @IsOptional()
  @IsEnum(LineaHeartbeatSummaryDelivery)
  summaryDelivery?: LineaHeartbeatSummaryDelivery;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  slackChannelId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string;
}

@InputType()
export class UpdateLineaWorkspacePromptInput {
  @Field()
  @IsString()
  prompt!: string;
}

@InputType()
export class UpsertLineaSkillInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  id?: string;

  @Field()
  @IsString()
  name!: string;

  @Field()
  @IsString()
  content!: string;
}

@InputType()
export class LineaMemoryQueryInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  query?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  namespace?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
