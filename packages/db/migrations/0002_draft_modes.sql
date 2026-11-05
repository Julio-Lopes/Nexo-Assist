CREATE TYPE "public"."draft_mode" AS ENUM('create', 'update', 'reopen');--> statement-breakpoint
ALTER TABLE "ticket_drafts" ADD COLUMN "mode" "draft_mode" DEFAULT 'create' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_drafts" ADD COLUMN "note" text;