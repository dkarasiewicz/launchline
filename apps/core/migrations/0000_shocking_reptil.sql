CREATE TYPE "public"."NotificationEntityType" AS ENUM('USER', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."NotificationPriority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."UserRole" AS ENUM('ADMIN', 'WORKSPACE_MEMBER', 'WORKSPACE_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."WorkspaceMembershipRole" AS ENUM('MEMBER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."WorkspaceMembershipStatus" AS ENUM('INVITED', 'ACTIVE', 'INACTIVE', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"entityId" text,
	"entityType" "NotificationEntityType" NOT NULL,
	"priority" "NotificationPriority" DEFAULT 'MEDIUM' NOT NULL,
	"userId" text NOT NULL,
	"readAt" timestamp (3),
	"actionUrl" text,
	"actionLabel" text,
	"icon" text
);
--> statement-breakpoint
CREATE TABLE "Otp" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"code" text NOT NULL,
	"identifier" text NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"userId" text,
	"attemptCount" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"email" text,
	"isEmailVerified" boolean DEFAULT false NOT NULL,
	"isOnboardingComplete" boolean DEFAULT false NOT NULL,
	"role" "UserRole" DEFAULT 'WORKSPACE_ADMIN' NOT NULL,
	"fullName" text
);
--> statement-breakpoint
CREATE TABLE "Workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"name" text NOT NULL,
	"deactivatedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "WorkspaceInvite" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"createdByUserId" text NOT NULL,
	"token" text NOT NULL,
	"workspaceMembershipId" text NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"disabledAt" timestamp (3),
	"consumedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "WorkspaceMembership" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"workspaceId" text NOT NULL,
	"userId" text NOT NULL,
	"role" "WorkspaceMembershipRole" DEFAULT 'MEMBER' NOT NULL,
	"status" "WorkspaceMembershipStatus" DEFAULT 'INVITED' NOT NULL,
	"email" text,
	"fullName" text,
	"deactivatedAt" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceMembershipId_fkey" FOREIGN KEY ("workspaceMembershipId") REFERENCES "public"."WorkspaceMembership"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "Notification_userId_idx" ON "Notification" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Notification_entityType_idx" ON "Notification" USING btree ("entityType");--> statement-breakpoint
CREATE INDEX "Notification_entityId_idx" ON "Notification" USING btree ("entityId");--> statement-breakpoint
CREATE INDEX "Notification_readAt_idx" ON "Notification" USING btree ("readAt");--> statement-breakpoint
CREATE INDEX "Notification_createdAt_idx" ON "Notification" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Otp_identifier_isVerified_expiresAt_idx" ON "Otp" USING btree ("identifier" text_ops,"isVerified","expiresAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Otp_expiresAt_idx" ON "Otp" USING btree ("expiresAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "User_email_idx" ON "User" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "WorkspaceInvite_token_key" ON "WorkspaceInvite" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "WorkspaceInvite_expiresAt_idx" ON "WorkspaceInvite" USING btree ("expiresAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "WorkspaceInvite_consumedAt_idx" ON "WorkspaceInvite" USING btree ("consumedAt" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "WorkspaceMembership_workspace_user_unique" ON "WorkspaceMembership" USING btree ("workspaceId" text_ops,"userId" text_ops);
