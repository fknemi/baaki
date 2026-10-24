ALTER TABLE "events" ADD COLUMN "chain_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "events_chain_uniq" ON "events" USING btree ("business_id","entity_id","chain_seq");