import {
  IsEnum,
  IsOptional,
  ValidateNested,
  IsPhoneNumber,
  IsEmail,
  IsUUID,
  IsDateString,
  IsString,
} from 'class-validator';
import { plainToInstance, Type } from 'class-transformer';
import { randomUUID } from 'crypto';
import { WorkspaceMemberRole } from '@launchline/models';

export enum Domain {
  AUTH = 'AUTH',
  WORKSPACE = 'WORKSPACE',
}

export enum EventType {
  AUTH_USER_CREATED = 'AUTH_USER_CREATED',
  WORKSPACE_MEMBER_INVITED = 'WORKSPACE_MEMBER_INVITED',
  WORKSPACE_MEMBER_JOINED = 'WORKSPACE_MEMBER_JOINED',
}

export enum EventVersion {
  V1 = 'V1',
}

export enum UserIdentifierType {
  EMAIL = 'EMAIL',
}

export class AuthUserCreatedEventPayload {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @IsEnum(UserIdentifierType)
  identifierType!: UserIdentifierType;

  @IsDateString()
  emittedAt!: string;
}

export class WorkspaceMemberInvitedEventPayload {
  @IsUUID()
  inviteId!: string;

  @IsUUID()
  workspaceId!: string;

  @IsUUID()
  userId!: string;

  @IsPhoneNumber()
  @IsOptional()
  phoneNumber?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsDateString()
  emittedAt!: string;
}

export class WorkspaceMemberJoinedEventPayload {
  @IsUUID()
  workspaceId!: string;

  @IsUUID()
  userId!: string;

  @IsEmail()
  email!: string;

  @IsEnum(WorkspaceMemberRole)
  role!: WorkspaceMemberRole;

  @IsPhoneNumber()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsDateString()
  joinedAt!: string;

  @IsDateString()
  emittedAt!: string;
}

export type EventPayload =
  | AuthUserCreatedEventPayload
  | WorkspaceMemberInvitedEventPayload
  | WorkspaceMemberJoinedEventPayload;

export abstract class DomainEvent<T extends EventPayload> {
  @IsUUID()
  id!: string;

  @IsEnum(EventVersion)
  version!: EventVersion;

  @IsEnum(EventType)
  eventType!: EventType;

  @IsEnum(Domain)
  origin!: Domain;

  @ValidateNested()
  abstract payload: T;

  @IsOptional()
  @IsUUID()
  userId?: string;

  protected constructor(
    id: string,
    version: EventVersion,
    eventType: EventType,
    origin: Domain,
    userId?: string,
  ) {
    this.id = id;
    this.version = version;
    this.eventType = eventType;
    this.origin = origin;
    this.userId = userId;
  }
}

export class AuthUserCreatedEvent extends DomainEvent<AuthUserCreatedEventPayload> {
  @Type(() => AuthUserCreatedEventPayload)
  payload!: AuthUserCreatedEventPayload;

  constructor(
    payload: Pick<
      AuthUserCreatedEventPayload,
      keyof AuthUserCreatedEventPayload
    >,
    userId?: string,
  ) {
    super(
      randomUUID(),
      EventVersion.V1,
      EventType.AUTH_USER_CREATED,
      Domain.AUTH,
      userId,
    );

    this.payload = plainToInstance(AuthUserCreatedEventPayload, payload);
  }
}

export class WorkspaceMemberInvitedEvent extends DomainEvent<WorkspaceMemberInvitedEventPayload> {
  @Type(() => WorkspaceMemberInvitedEventPayload)
  payload!: WorkspaceMemberInvitedEventPayload;

  constructor(
    payload: Pick<
      WorkspaceMemberInvitedEventPayload,
      keyof WorkspaceMemberInvitedEventPayload
    >,
    userId?: string,
  ) {
    super(
      randomUUID(),
      EventVersion.V1,
      EventType.WORKSPACE_MEMBER_INVITED,
      Domain.WORKSPACE,
      userId,
    );

    this.payload = plainToInstance(WorkspaceMemberInvitedEventPayload, payload);
  }
}

export class WorkspaceMemberJoinedEvent extends DomainEvent<WorkspaceMemberJoinedEventPayload> {
  @Type(() => WorkspaceMemberJoinedEventPayload)
  payload!: WorkspaceMemberJoinedEventPayload;

  constructor(
    payload: Pick<
      WorkspaceMemberJoinedEventPayload,
      keyof WorkspaceMemberJoinedEventPayload
    >,
    userId?: string,
  ) {
    super(
      randomUUID(),
      EventVersion.V1,
      EventType.WORKSPACE_MEMBER_JOINED,
      Domain.WORKSPACE,
      userId,
    );

    this.payload = plainToInstance(WorkspaceMemberJoinedEventPayload, payload);
  }
}

export type DomainEventType =
  | AuthUserCreatedEvent
  | WorkspaceMemberInvitedEvent
  | WorkspaceMemberJoinedEvent;

export const EventTypeToDomainEventMap = {
  [EventType.AUTH_USER_CREATED]: AuthUserCreatedEvent,
  [EventType.WORKSPACE_MEMBER_INVITED]: WorkspaceMemberInvitedEvent,
  [EventType.WORKSPACE_MEMBER_JOINED]: WorkspaceMemberJoinedEvent,
};
