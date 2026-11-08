CREATE TABLE "agent_events" (
	"id" text PRIMARY KEY NOT NULL,
	"mandate_id" text NOT NULL,
	"run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"tool" text,
	"title" text NOT NULL,
	"detail" jsonb,
	"verdict" text,
	"rule" text,
	"amount" numeric(12, 2),
	"merchant" text,
	"paypal_id" text
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"mandate_id" text NOT NULL,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"mandate_id" text NOT NULL,
	"run_id" text,
	"product" jsonb NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"rationale" text,
	"evaluation" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" text PRIMARY KEY NOT NULL,
	"raw_text" text NOT NULL,
	"policy" jsonb NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"paypal_order_id" text,
	"authorization_id" text,
	"payer_email" text,
	"budget_total" numeric(12, 2) NOT NULL,
	"authorized_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"spent_total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"refunded_total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"items_bought" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"mandate_id" text NOT NULL,
	"product" jsonb NOT NULL,
	"merchant" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"capture_id" text,
	"status" text NOT NULL,
	"refund_id" text,
	"tracking_number" text,
	"rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"results" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_mandate_idx" ON "agent_events" USING btree ("mandate_id","created_at");