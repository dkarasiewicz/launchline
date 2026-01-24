CREATE TYPE "public"."IntegrationStatus" AS ENUM('pending', 'active', 'error', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."IntegrationType" AS ENUM('linear', 'slack', 'github', 'jira', 'notion');--> statement-breakpoint
CREATE TABLE "Integration" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"workspaceId" text NOT NULL,
	"type" "IntegrationType" NOT NULL,
	"status" "IntegrationStatus" DEFAULT 'pending' NOT NULL,
	"name" text,
	"description" text,
	"externalAccountId" text,
	"externalAccountName" text,
	"externalOrganizationId" text,
	"externalOrganizationName" text,
	"scopes" text,
	"webhookId" text,
	"webhookUrl" text,
	"webhookSecret" text,
	"accessToken" text,
	"refreshToken" text,
	"tokenType" text,
	"tokenExpiresAt" timestamp (3),
	"lastSyncAt" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "primaryWorkspaceId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "Integration_workspaceId_idx" ON "Integration" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "Integration_type_idx" ON "Integration" USING btree ("type");--> statement-breakpoint
CREATE INDEX "Integration_status_idx" ON "Integration" USING btree ("status");