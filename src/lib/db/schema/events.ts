import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const events = pgTable(
  "events",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    chainSeq: integer("chain_seq").notNull().default(0),
    businessId: uuid("business_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    type: text("type").notNull(),
    actor: text("actor").notNull(),
    atIso: timestamp("at_iso", { withTimezone: true }).notNull(),
    payload: jsonb("payload").notNull(),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => ({
    entityIdx: index("events_entity_idx").on(t.entityType, t.entityId),
    hashUniq: uniqueIndex("events_hash_uniq").on(t.hash),
    chainUniq: uniqueIndex("events_chain_uniq").on(t.businessId, t.entityId, t.chainSeq),
  }),
);
