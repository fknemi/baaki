import { bigint, date, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./businesses";
import { invoices } from "./invoices";

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  paidOn: date("paid_on").notNull(),
  reference: text("reference"),
  idempotencyKey: text("idempotency_key").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
