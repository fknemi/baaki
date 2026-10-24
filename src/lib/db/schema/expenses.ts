import { bigint, boolean, date, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./businesses";

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  label: text("label").notNull(),
  category: text("category").notNull(),
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  recurrence: text("recurrence").notNull().default("once"),
  dayOfMonth: integer("day_of_month"),
  dueDate: date("due_date"),
  paid: boolean("paid").notNull().default(false),
});
