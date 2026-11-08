ALTER TABLE "mandates" ADD COLUMN "red_team" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "signature_hash" text;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "signature" text;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "signing_public_key" text;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "signed_at" timestamp with time zone;