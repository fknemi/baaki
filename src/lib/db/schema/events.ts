import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Append-only hash-linked event chain.
 * UPDATE and DELETE are blocked by a trigger installed in
 * drizzle/0001_admin_roles_triggers.sql — do not drop that file.
 */
export const events = pgTable(
  "events",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
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
  }),
);
