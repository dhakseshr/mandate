ALTER TABLE "mandates" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "root_id" text;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "revoked_at" timestamp with time zone;