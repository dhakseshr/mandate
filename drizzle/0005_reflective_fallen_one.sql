CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "signed_with" text;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "passkey_credential_id" text;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "passkey_intent_hash" text;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "passkey_assertion" jsonb;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "passkey_challenge" text;