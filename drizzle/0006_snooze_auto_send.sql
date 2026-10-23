ALTER TABLE "businesses" ADD COLUMN "ladder_override" jsonb;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "auto_send_stages" jsonb DEFAULT '["headsUp","dueDate"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "snoozed_until" date;