import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditAdmin = pgTable("audit_admin", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload").notNull(),
  atIso: timestamp("at_iso", { withTimezone: true }).notNull().defaultNow(),
});
