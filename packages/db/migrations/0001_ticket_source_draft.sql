ALTER TABLE "tickets" ADD COLUMN "source_draft_id" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_source_draft_id_unique" UNIQUE("source_draft_id");