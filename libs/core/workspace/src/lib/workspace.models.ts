import {
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { WorkspaceMemberRole, WorkspaceMemberStatus } from '@launchline/models';

registerEnumType(WorkspaceMemberStatus, {
  name: 'WorkspaceMemberStatus',
});

registerEnumType(WorkspaceMemberRole, {
  name: 'WorkspaceMemberRole',
});

@ObjectType()
export class WorkspaceMember {
  @Field()
  id!: string;

  @Field(() => String, { nullable: true })
  userId?: string;

  @Field(() => String, { nullable: true })
  inviteId?: string;

  @Field(() => String, { nullable: true })
  fullName?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phoneNumber?: string;

  @Field(() => WorkspaceMemberRole)
  role!: WorkspaceMemberRole;

  @Field(() => WorkspaceMemberStatus)
  status!: WorkspaceMemberStatus;

  @Field(() => Date, { nullable: true })
  invitedAt?: Date;

  @Field(() => Date, { nullable: true })
  joinedAt?: Date;

  @Field(() => Date, { nullable: true })
  deactivatedAt?: Date;
}

@ObjectType()
export class Workspace {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field(() => Date, { nullable: true })
  deactivatedAt?: Date;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => [WorkspaceMember])
  members!: WorkspaceMember[];
}

@ObjectType()
export class WorkspaceInvitation {
  @Field()
  token!: string;

  @Field()
  workspaceId!: string;

  @Field(() => String, { nullable: true })
  workspaceName?: string;

  @Field(() => WorkspaceMemberRole)
  role!: WorkspaceMemberRole;

  @Field(() => String, { nullable: true })
  emailHint?: string;

  @Field(() => Date)
  expiresAt!: Date;
}

@InputType()
export class CreateWorkspaceInvitationInput {
  @Field()
  @IsString()
  workspaceId!: string;

  @Field(() => WorkspaceMemberRole)
  @IsEnum(WorkspaceMemberRole)
  role!: WorkspaceMemberRole;

  @Field(() => String, { nullable: true })
  @IsEmail()
  @IsOptional()
  emailHint?: string;

  @Field(() => String, { nullable: true })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

@InputType()
export class GetWorkspaceInvitationInput {
  @Field()
  @IsString()
  token!: string;
}

@InputType()
export class RedeemWorkspaceInvitationInput {
  @Field()
  @IsString()
  token!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  fullName?: string;

  @Field(() => String)
  @IsEmail()
  email!: string;
}

@InputType()
export class CreateWorkspaceInput {
  @Field()
  @IsString()
  name!: string;

  @Field()
  @IsEmail()
  adminEmail!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  adminName?: string;

  @Field(() => String, { nullable: true })
  @IsDateString()
  @IsOptional()
  inviteExpiresAt?: string;
}

@ObjectType()
export class CreateWorkspaceResult {
  @Field()
  workspaceId!: string;

  @Field()
  workspaceName!: string;

  @Field()
  inviteToken!: string;

  @Field()
  adminEmail!: string;

  @Field(() => Date)
  inviteExpiresAt!: Date;
}
