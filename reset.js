#!/usr/bin/env bun
// Resets the Baaki demo database to a pristine state.
// Runs as the owner role (DATABASE_URL) — same connection as seed.mjs.
// Usage:  bun reset.js
//
// Works on both self-hosted Postgres AND managed DBs (Neon, Supabase,
// Railway). On managed DBs the baaki_app role is dropped with a plain
// DROP ROLE (no REASSIGN/DROP OWNED — which managed providers deny).
//
// What it does:
//   1. TRUNCATE all demo tables, restart identities, cascade
//   2. Drop the app role `baaki_app` (plain DROP ROLE — works everywhere
//      because baaki_app never owns objects, only receives grants)
//   3. Sanity-check that every table is actually empty
//
// What it does NOT do:
//   • Drop or recreate the schema (migrations untouched)
//   • Touch anything outside the tables listed below

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 5 });

// Every table the seed writes to, plus sessions/events which are
// logically tied to the demo. Order matters only for the cascade; we
// use RESTART IDENTITY CASCADE so listing children first is fine.
const TABLES = [
  "inbox_items",
  "payments",
  "reminder_log",
  "invoice_items",
  "invoices",
  "evidence_files",
  "expenses",
  "customers",
  "business_members",
  "businesses",
  "users",
  "sessions",
  "events",
];

async function main() {
  // ─── Sanity: confirm required env ─────────────────────────────
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  // ─── 0. Detect DB capability (CREATEROLE probe) ──────────────
  // Managed DBs (Neon, Supabase) do NOT grant CREATEROLE to app users.
  // Probe that directly instead of inferring from CREATE-on-database.
  const [cap] = await sql`
    SELECT
      (SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user)
        AS can_createrole,
      current_setting('is_superuser')::boolean AS is_super
  `;
  const isManaged = !cap.can_createrole && !cap.is_super;

  // ─── 1. Truncate all demo tables ──────────────────────────────
  console.log("Truncating demo tables…");
  const tableList = TABLES.map((t) => `"${t}"`).join(", ");
  await sql.unsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);

  // ─── 2. Drop the app role ────────────────────────────────────
  // Plain DROP ROLE — no REASSIGN OWNED / DROP OWNED. baaki_app never
  // owns objects (it only receives grants, which vanish on drop), so
  // plain DROP ROLE works on both self-hosted and managed DBs.
  console.log("Dropping app role baaki_app (if present)…");
  try {
    const [{ exists }] = await sql`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'baaki_app') AS exists
    `;
    if (!exists) {
      console.log("  Role baaki_app not present.");
    } else if (isManaged) {
      console.log("  Skipped — managed DB without CREATEROLE.");
      console.log("  App uses the same DATABASE_URL as this seed, so nothing to clean up.");
    } else {
      await sql.unsafe(`DROP ROLE baaki_app`);
      console.log("  Role baaki_app dropped.");
    }
  } catch (err) {
    console.warn("  Could not drop baaki_app (non-fatal):", err.message);
  }

  // ─── 3. Verify emptiness ──────────────────────────────────────
  console.log("Verifying empty state…");
  const results = await Promise.all(
    TABLES.map(async (t) => {
      const [{ count }] = await sql.unsafe(`SELECT COUNT(*)::int AS count FROM "${t}"`);
      return { table: t, count };
    }),
  );
  const nonEmpty = results.filter((r) => r.count !== 0);
  if (nonEmpty.length > 0) {
    console.error("Reset incomplete — rows still present:");
    for (const r of nonEmpty) console.error(`  ${r.table}: ${r.count}`);
    process.exit(1);
  }

  console.log("");
  console.log("Reset complete. All 13 tables are empty.");
  console.log("Run `bun seed` to repopulate.");
}

try {
  await main();
} catch (err) {
  console.error("Reset failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}
