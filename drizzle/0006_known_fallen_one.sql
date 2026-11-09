CREATE TABLE "disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_id" text,
	"mandate_id" text,
	"capture_id" text NOT NULL,
	"reason" text,
	"status" text NOT NULL,
	"amount" numeric(12, 2),
	"response" text,
	"pack_sha256" text,
	"outcome" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE no action ON UPDATE no action;