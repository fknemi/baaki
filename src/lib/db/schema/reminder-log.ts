import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./businesses";
import { invoices } from "./invoices";

export const reminderLog = pgTable(
  "reminder_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    stageKey: text("stage_key").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("pending"),
    providerId: text("provider_id"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => ({ uniq: uniqueIndex("reminder_uniq").on(t.invoiceId, t.stageKey) }),
);
