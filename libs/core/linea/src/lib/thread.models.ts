import {
  Field,
  ObjectType,
  InputType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum ThreadStatus {
  REGULAR = 'regular',
  ARCHIVED = 'archived',
}

registerEnumType(ThreadStatus, {
  name: 'ThreadStatus',
  description: 'The status of a thread',
});

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

registerEnumType(MessageRole, {
  name: 'MessageRole',
  description: 'The role of a message sender',
});

@ObjectType()
export class Thread {
  @Field()
  remoteId!: string;

  @Field(() => ThreadStatus)
  status!: ThreadStatus;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  updatedAt?: Date;

  // Inbox metadata
  @Field({ nullable: true })
  isInboxThread?: boolean;

  @Field({ nullable: true })
  inboxItemType?: string;

  @Field({ nullable: true })
  inboxPriority?: string;

  @Field({ nullable: true })
  inboxStatus?: string;

  @Field({ nullable: true })
  summary?: string;

  @Field({ nullable: true })
  projectId?: string;

  @Field({ nullable: true })
  featureId?: string;
}

@ObjectType()
export class ThreadListResponse {
  @Field(() => [Thread])
  threads!: Thread[];
}

@ObjectType()
export class InitializeThreadResponse {
  @Field()
  remoteId!: string;

  @Field()
  externalId!: string;
}

@InputType()
export class InitializeThreadInput {
  @Field()
  @IsString()
  threadId!: string;
}

@InputType()
export class RenameThreadInput {
  @Field()
  @IsString()
  threadId!: string;

  @Field()
  @IsString()
  newTitle!: string;
}

@InputType()
export class GenerateTitleInput {
  @Field()
  @IsString()
  threadId!: string;

  @Field(() => [MessageInput])
  @ValidateNested({ each: true })
  @Type(() => MessageInput)
  messages!: MessageInput[];
}

@InputType()
export class MessageInput {
  @Field()
  @IsString()
  id!: string;

  @Field()
  @IsString()
  role!: MessageRole;

  @Field()
  @IsString()
  content!: string;
}
