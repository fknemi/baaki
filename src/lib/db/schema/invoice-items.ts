import { bigint, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { invoices } from "./invoices";

export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  hsnSac: text("hsn_sac").notNull(),
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  ratePaise: bigint("rate_paise", { mode: "number" }).notNull(),
  discountPaise: bigint("discount_paise", { mode: "number" }).notNull().default(0),
  gstRatePct: numeric("gst_rate_pct", { precision: 5, scale: 2 }).notNull(),
});
