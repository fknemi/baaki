import { boolean, bigint, pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const businesses = pgTable("businesses", {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    addressJson: jsonb("address_json").notNull(),
    gstin: text("gstin"),
    registrationType: text("registration_type").notNull().default("regular"),
    turnoverPaise: bigint("turnover_paise", { mode: "number" }).notNull().default(0),
    everCrossedEinvoiceThreshold: boolean("ever_crossed_einvoice_threshold").notNull().default(false),
    udyamRegistered: boolean("udyam_registered").notNull().default(false),
    udyamType: text("udyam_type"),
    bankJson: jsonb("bank_json"),
    upiId: text("upi_id"),
    safetyBufferPaise: bigint("safety_buffer_paise", { mode: "number" }).notNull(),
    openingCashPaise: bigint("opening_cash_paise", { mode: "number" }).notNull(),
    ladderOverride: jsonb("ladder_override"),
    autoSendStages: jsonb("auto_send_stages").notNull().default(["headsUp", "dueDate"]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
