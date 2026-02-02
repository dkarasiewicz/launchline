ALTER TYPE "public"."IntegrationType" ADD VALUE 'google';--> statement-breakpoint
ALTER TABLE "Integration" DROP CONSTRAINT "Integration_workspaceId_fkey";
--> statement-breakpoint
ALTER TABLE "Integration" DROP COLUMN "webhookId";--> statement-breakpoint
ALTER TABLE "Integration" DROP COLUMN "webhookUrl";--> statement-breakpoint
ALTER TABLE "Integration" DROP COLUMN "webhookSecret";--> statement-breakpoint
ALTER TABLE "Integration" DROP COLUMN "tokenType";