ALTER TABLE "mandates" ADD COLUMN "agent_mode" text DEFAULT 'builtin' NOT NULL;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "agent_token" text;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_agent_token_unique" UNIQUE("agent_token");