import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const otpChallenges = pgTable("otp_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  phoneE164: text("phone_e164").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumed: boolean("consumed").notNull().default(false),
});
