CREATE TABLE "events" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"at_iso" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_entity_idx" ON "events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_hash_uniq" ON "events" USING btree ("hash");