import {
  bigint,
  boolean,
  date,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses } from "./businesses";
import { customers } from "./customers";

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    number: text("number").notNull(),
    invoiceDate: date("invoice_date").notNull(),
    dueDate: date("due_date").notNull(),
    placeOfSupplyStateCode: text("place_of_supply_state_code").notNull(),
    reverseCharge: boolean("reverse_charge").notNull().default(false),
    deliveryAddressJson: jsonb("delivery_address_json"),
    status: text("status").notNull().default("draft"),
    amountPaidPaise: bigint("amount_paid_paise", { mode: "number" }).notNull().default(0),
    disputed: boolean("disputed").notNull().default(false),
    promiseToPayDate: date("promise_to_pay_date"),
    snoozedUntil: date("snoozed_until"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniq: uniqueIndex("inv_business_number_uniq").on(t.businessId, t.number) }),
);
