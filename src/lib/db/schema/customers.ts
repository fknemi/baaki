import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./businesses";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id),
  name: text("name").notNull(),
  gstin: text("gstin"),
  stateCode: text("state_code"),
  placeOfSupplyState: text("place_of_supply_state"),
  city: text("city"),
  phoneMasked: text("phone_masked"),
  email: text("email"),
  creditDays: integer("credit_days").notNull().default(30),
  preferredLanguage: text("preferred_language").notNull().default("en"),
  payToken: text("pay_token").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
