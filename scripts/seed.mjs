#!/usr/bin/env bun
// Seeds demo data for Baaki.
// Requires DATABASE_URL (owner role) in env.
// Run: bun seed  OR  bun --env-file=.env.local scripts/seed.mjs

import postgres from "postgres";
import { randomUUID, createHash } from "node:crypto";
import { computeTotals } from "../src/lib/domain/gst.ts";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 5 });

// ─── addDays (matches src/lib/domain/dates.ts) ──────────────────────
function addDays(yyyymmdd, days) {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const dt = new Date(ms);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Hash chain helpers — MUST match src/lib/db/hashchain-server.ts ──
function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

function canonicalJson(v) {
  if (v === null) return "null";
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(v[k])).join(",") + "}";
}

function canonicalTime(iso) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(Math.floor(d.getTime() / 1000) * 1000).toISOString().replace(".000Z", "Z");
}

function genesisHash() {
  return sha256("GENESIS");
}

function computeHash(prevHash, evt) {
  const canonical = canonicalJson({
    seq: evt.seq,
    type: evt.type,
    entityId: evt.entityId,
    actor: evt.actor,
    atIso: canonicalTime(evt.atIso),
    payload: evt.payload,
  });
  return sha256(prevHash + canonical);
}

async function insertInvoiceCreatedEvent({
  businessId,
  invoiceId,
  actor,
  atIso,
  number,
  customerId,
  items,
  totals,
}) {
  const prevHash = genesisHash();
  const evt = {
    seq: 1,
    type: "INVOICE_CREATED",
    entityId: invoiceId,
    actor,
    atIso,
    payload: { number, customerId, items, totals },
  };
  const hash = computeHash(prevHash, evt);

  await sql`
    INSERT INTO events
      (business_id, entity_type, entity_id, type, actor, at_iso, payload, prev_hash, hash, chain_seq)
    VALUES
      (${businessId}, 'invoice', ${invoiceId}, 'INVOICE_CREATED', ${actor},
       ${new Date(atIso)}, ${sql.json(evt.payload)}, ${prevHash}, ${hash}, 1)
  `;
  return { hash, chainSeq: 1 };
}

async function insertPaymentConfirmedEvent({
  businessId,
  invoiceId,
  actor,
  atIso,
  amountPaise,
  paidOn,
  reference,
  prevEventHash,
}) {
  const evt = {
    seq: 2,
    type: "PAYMENT_CONFIRMED",
    entityId: invoiceId,
    actor,
    atIso,
    payload: { amountPaise, paidOn, reference, seeded: true },
  };
  const hash = computeHash(prevEventHash, evt);

  await sql`
    INSERT INTO events
      (business_id, entity_type, entity_id, type, actor, at_iso, payload, prev_hash, hash, chain_seq)
    VALUES
      (${businessId}, 'invoice', ${invoiceId}, 'PAYMENT_CONFIRMED', ${actor},
       ${new Date(atIso)}, ${sql.json(evt.payload)}, ${prevEventHash}, ${hash}, 2)
  `;
  return { hash, chainSeq: 2 };
}

// ─── GSTIN mod-36 checksum ─────────────────────────────────────────
const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function gstin(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const f = i % 2 === 0 ? 1 : 2;
    const p = CHARSET.indexOf(first14[i]) * f;
    sum += Math.floor(p / 36) + (p % 36);
  }
  return first14 + CHARSET[(36 - (sum % 36)) % 36];
}

// ═══════════════════════════════════════════════════════════════════
async function main() {
  console.log("Clearing existing data…");
  await sql`
    TRUNCATE TABLE
      inbox_items, payments, reminder_log, invoice_items, invoices,
      evidence_files, expenses, customers, business_members,
      businesses, users, sessions, events
    RESTART IDENTITY CASCADE
  `;

  // ─── User + business ──────────────────────────────────────────
  console.log("Seeding user + business…");
  const userId = randomUUID();
  const businessId = randomUUID();

  await sql`
    INSERT INTO users (id, phone_e164, name, email)
    VALUES (${userId}, '+918357037152', 'Rakesh Sharma', 'fk.nemi.kf@gmail.com')
  `;

  await sql`
    INSERT INTO businesses (
      id, owner_id, name, address_json, gstin, registration_type,
      turnover_paise, ever_crossed_einvoice_threshold, udyam_registered,
      udyam_type, bank_json, upi_id, safety_buffer_paise, opening_cash_paise,
      auto_send_stages
    ) VALUES (
      ${businessId}, ${userId}, 'Sharma Packaging',
      ${sql.json({ line1: "123 Industrial Area", city: "Pune", state: "Maharashtra", stateCode: "27", pincode: "411001" })},
      '27AAPFU0939F1ZV', 'regular',
      420000000, false, true, 'micro',
      ${sql.json({ accountName: "Sharma Packaging", accountNumberMasked: "XXXX XXXX 4821", ifsc: "HDFC0001234", bankName: "HDFC Bank" })},
      'sharmapackaging@okokhdfcbank',
      30000000, 85000000,
      ${sql.json(["headsUp", "dueDate", "firm"])}
    )
  `;

  await sql`
    INSERT INTO business_members (business_id, user_id, role, accepted_at)
    VALUES (${businessId}, ${userId}, 'owner', now())
  `;

  // ─── Customers ───────────────────────────────────────────────
  // Paid latency per customer — becomes historical record in `payments`,
  // from which forecast/route.ts derives avgDaysLate per spec §2.8.
  console.log("Seeding 12 customers…");
  const customerPaidLatency = [0, 12, 18, 0, 10, 0, 8, 0, 20, 0, 14, 0];
  const customers = [
    {
      name: "Krishna Traders",
      pan: "BBBPK1234K",
      state: "27",
      stateName: "Maharashtra",
      city: "Pune",
      lang: "en",
      email: "fk.nemi.kf@gmail.com",
      phone: "+918357037152",
    },
    {
      name: "Patel Brothers",
      pan: "AABCP5678P",
      state: "24",
      stateName: "Gujarat",
      city: "Ahmedabad",
      lang: "hi",
    },
    {
      name: "Sunrise Agencies",
      pan: "AABCS9012S",
      state: "29",
      stateName: "Karnataka",
      city: "Bengaluru",
      lang: "en",
    },
    {
      name: "Mehta & Co",
      pan: "AABCM3456M",
      state: "27",
      stateName: "Maharashtra",
      city: "Mumbai",
      lang: "en",
    },
    {
      name: "Royal Industries",
      pan: "AABCR7890R",
      state: "27",
      stateName: "Maharashtra",
      city: "Pune",
      lang: "en",
    },
    {
      name: "Delhi Distributors",
      pan: "AABCD2345D",
      state: "07",
      stateName: "Delhi",
      city: "Delhi",
      lang: "hi",
    },
    {
      name: "Mumbai Supplies",
      pan: "AABCM6789M",
      state: "27",
      stateName: "Maharashtra",
      city: "Mumbai",
      lang: "hi",
    },
    {
      name: "Bangalore Boxes",
      pan: "AABCB1357B",
      state: "29",
      stateName: "Karnataka",
      city: "Bengaluru",
      lang: "en",
    },
    {
      name: "Chennai Traders",
      pan: "AABCT2468T",
      state: "33",
      stateName: "Tamil Nadu",
      city: "Chennai",
      lang: "en",
    },
    {
      name: "Hyderabad Hub",
      pan: "AABCH3579H",
      state: "36",
      stateName: "Telangana",
      city: "Hyderabad",
      lang: "en",
    },
    {
      name: "Kolkata Kart",
      pan: "AABCK4680K",
      state: "19",
      stateName: "West Bengal",
      city: "Kolkata",
      lang: "hi",
    },
    {
      name: "Gujarat Traders",
      pan: "AABCG5791G",
      state: "24",
      stateName: "Gujarat",
      city: "Surat",
      lang: "hi",
    },
  ];
  const customerIds = [];
  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const g = gstin(`${c.state}${c.pan}1Z`);
    const id = randomUUID();
    customerIds.push(id);
    const phone = c.phone ?? `+91 98XXX XX${100 + i}`;
    const email = c.email ?? `contact${i + 1}@example.test`;
    const payToken = `tok-${i + 1}`;
    await sql`
      INSERT INTO customers (
        id, business_id, name, gstin, state_code, place_of_supply_state,
        city, phone_masked, email, credit_days, preferred_language, pay_token
      ) VALUES (
        ${id}, ${businessId}, ${c.name}, ${g}, ${c.state}, ${c.stateName},
        ${c.city}, ${phone}, ${email}, 30, ${c.lang}, ${payToken}
      )
    `;
  }

  // ─── Invoices ────────────────────────────────────────────────
  console.log("Seeding 40 invoices…");

  const invoicePlan = [
    ...Array(8).fill("paid"),
    ...Array(5).fill("part-paid"),
    ...Array(6).fill("due-soon"),
    ...Array(14).fill("overdue"),
    "disputed",
    ...Array(2).fill("draft"),
    ...Array(4).fill("sent"),
  ];

  // Anchor: prefer NEXT_PUBLIC_DEMO_TODAY (so seed and app stay in sync),
  // fall back to 2026-11-01 which is what the design doc assumes.
  const todayStr = process.env.NEXT_PUBLIC_DEMO_TODAY ?? "2026-11-01";
  const today = new Date(todayStr + "T00:00:00Z");
  let seq = 1;

  for (let i = 0; i < invoicePlan.length; i++) {
    const kind = invoicePlan[i];
    const number = `INV/26-27/${String(seq++).padStart(4, "0")}`;
    const isDemo = number === "INV/26-27/0012";

    if (isDemo) {
      const custId = customerIds[0];
      const invoiceId = randomUUID();
      const dueDateStr = "2026-11-01";

      await sql`
        INSERT INTO invoices (
          id, business_id, customer_id, number, invoice_date, due_date,
          place_of_supply_state_code, status, amount_paid_paise, disputed
        ) VALUES (
          ${invoiceId}, ${businessId}, ${custId}, ${number},
          '2026-10-02', ${dueDateStr}, '27', 'sent', 0, false
        )
      `;

      const demoItems = [
        {
          description: "Corrugated box 12x12x8",
          hsnSac: "4819",
          qty: 500,
          unit: "pcs",
          ratePaise: 12000,
          discountPaise: 0,
          gstRatePct: 18,
        },
        {
          description: "Corrugated box 15x10x6",
          hsnSac: "4819",
          qty: 200,
          unit: "pcs",
          ratePaise: 15000,
          discountPaise: 0,
          gstRatePct: 18,
        },
        {
          description: "Packing tape 2 inch",
          hsnSac: "3919",
          qty: 100,
          unit: "rolls",
          ratePaise: 10000,
          discountPaise: 0,
          gstRatePct: 18,
        },
      ];

      const insertedItems = await sql`
        INSERT INTO invoice_items (
          invoice_id, description, hsn_sac, qty, unit, rate_paise, discount_paise, gst_rate_pct
        ) VALUES ${sql(demoItems.map((it) => [invoiceId, it.description, it.hsnSac, it.qty, it.unit, it.ratePaise, it.discountPaise, it.gstRatePct]))}
        RETURNING description, hsn_sac, qty, unit, rate_paise, discount_paise, gst_rate_pct
      `;

      const totals = computeTotals(
        insertedItems.map((it) => ({
          qty: Number(it.qty),
          ratePaise: it.rate_paise,
          discountPaise: it.discount_paise,
          gstRatePct: Number(it.gst_rate_pct),
        })),
        { stateCode: "27", registrationType: "regular" },
        { stateCode: "27" },
      );

      await insertInvoiceCreatedEvent({
        businessId,
        invoiceId,
        actor: `user:${userId}`,
        atIso: "2026-10-02T10:00:00+05:30",
        number,
        customerId: custId,
        items: insertedItems.map((it) => ({
          description: it.description,
          hsnSac: it.hsn_sac,
          qty: Number(it.qty),
          unit: it.unit,
          ratePaise: it.rate_paise,
          discountPaise: it.discount_paise,
          gstRatePct: Number(it.gst_rate_pct),
        })),
        totals,
      });

      continue;
    }

    const custId = customerIds[i % customerIds.length];
    const customer = customers[i % customers.length];
    const amount = 25000 + i * 3000;

    // Compute item + precomputed totals BEFORE kind branch, so `paid` can
    // use the real rounded total (avoids paidPaise = amount*100 drift).
    const qty = 100;
    const ratePaise = Math.floor((amount * 100) / 1.18 / qty);
    const precomputedTotals = computeTotals(
      [{ qty, ratePaise, discountPaise: 0, gstRatePct: 18 }],
      { stateCode: "27", registrationType: "regular" },
      { stateCode: customer.state },
    );

    let dueOffset;
    let paidPaise = 0;
    let status = "sent";

    if (kind === "paid") {
      dueOffset = -45 - i;
      paidPaise = precomputedTotals.totalPaise;
      status = "paid";
    } else if (kind === "part-paid") {
      dueOffset = -20 - i;
      paidPaise = Math.floor(precomputedTotals.totalPaise * 0.4);
      // NOTE: status stays "sent" — part-paid is derived from amount_paid < total
    } else if (kind === "due-soon") {
      dueOffset = 3 + (i % 5);
    } else if (kind === "overdue") {
      dueOffset = -5 - i * 4;
    } else if (kind === "disputed") {
      dueOffset = -30;
    } else if (kind === "draft") {
      dueOffset = 20;
      status = "draft";
    } else {
      dueOffset = 10 + i;
    }

    const invoiceDate = new Date(today);
    invoiceDate.setUTCDate(today.getUTCDate() + dueOffset - 30);
    const dueDate = new Date(today);
    dueDate.setUTCDate(today.getUTCDate() + dueOffset);

    const invoiceDateStr = invoiceDate.toISOString().split("T")[0];
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const invoiceId = randomUUID();

    await sql`
      INSERT INTO invoices (
        id, business_id, customer_id, number, invoice_date, due_date,
        place_of_supply_state_code, status, amount_paid_paise, disputed
      ) VALUES (
        ${invoiceId}, ${businessId}, ${custId}, ${number},
        ${invoiceDateStr}, ${dueDateStr},
        ${customer.state}, ${status}, ${paidPaise}, ${kind === "disputed"}
      )
    `;

    const [item] = await sql`
      INSERT INTO invoice_items (
        invoice_id, description, hsn_sac, qty, unit, rate_paise, discount_paise, gst_rate_pct
      ) VALUES (
        ${invoiceId}, 'Corrugated box 12x12', '4819', ${qty}, 'pcs',
        ${ratePaise}, 0, 18
      )
      RETURNING description, hsn_sac, qty, unit, rate_paise, discount_paise, gst_rate_pct
    `;

    const totals = computeTotals(
      [
        {
          qty: Number(item.qty),
          ratePaise: item.rate_paise,
          discountPaise: item.discount_paise,
          gstRatePct: Number(item.gst_rate_pct),
        },
      ],
      { stateCode: "27", registrationType: "regular" },
      { stateCode: customer.state },
    );

    const createdEvent = await insertInvoiceCreatedEvent({
      businessId,
      invoiceId,
      actor: `user:${userId}`,
      atIso: `${invoiceDateStr}T10:00:00+05:30`,
      number,
      customerId: custId,
      items: [
        {
          description: item.description,
          hsnSac: item.hsn_sac,
          qty: Number(item.qty),
          unit: item.unit,
          ratePaise: item.rate_paise,
          discountPaise: item.discount_paise,
          gstRatePct: Number(item.gst_rate_pct),
        },
      ],
      totals,
    });

    // ─── Insert payments + PAYMENT_CONFIRMED events for paid / part-paid ──
    // paid_on = due_date + customerPaidLatency[idx]. This is the historical
    // record that /api/forecast derives avgDaysLate from (spec §2.8).
    if (kind === "paid" || kind === "part-paid") {
      const custIdx = i % customers.length;
      const daysLate = customerPaidLatency[custIdx];
      const paidOn = addDays(dueDateStr, daysLate);
      const reference = `seed-${number}`;

      await sql`
        INSERT INTO payments (
          business_id, invoice_id, amount_paise, paid_on, reference, idempotency_key
        ) VALUES (
          ${businessId}, ${invoiceId}, ${paidPaise}, ${paidOn}, ${reference}, ${reference}
        )
      `;

      await insertPaymentConfirmedEvent({
        businessId,
        invoiceId,
        actor: `user:${userId}`,
        atIso: `${paidOn}T10:00:00+05:30`,
        amountPaise: paidPaise,
        paidOn,
        reference,
        prevEventHash: createdEvent.hash,
      });
    }
  }

  // ─── Matcher fixtures (0041-0045) ───────────────────────────
  console.log("Seeding matcher fixtures 0041-0045…");

  async function seedFixture({ seq, customerIdx, description, taxablePaise }) {
    const custId = customerIds[customerIdx];
    const customer = customers[customerIdx];
    const number = `INV/26-27/${String(seq).padStart(4, "0")}`;
    const invoiceId = randomUUID();

    await sql`
      INSERT INTO invoices (
        id, business_id, customer_id, number, invoice_date, due_date,
        place_of_supply_state_code, status, amount_paid_paise, disputed
      ) VALUES (
        ${invoiceId}, ${businessId}, ${custId}, ${number},
        '2026-10-02', '2026-11-01',
        ${customer.state}, 'sent', 0, false
      )
    `;

    const [item] = await sql`
      INSERT INTO invoice_items (
        invoice_id, description, hsn_sac, qty, unit, rate_paise, discount_paise, gst_rate_pct
      ) VALUES (
        ${invoiceId}, ${description}, '4819', 1, 'lot',
        ${taxablePaise}, 0, 18
      )
      RETURNING description, hsn_sac, qty, unit, rate_paise, discount_paise, gst_rate_pct
    `;

    const totals = computeTotals(
      [
        {
          qty: Number(item.qty),
          ratePaise: item.rate_paise,
          discountPaise: item.discount_paise,
          gstRatePct: Number(item.gst_rate_pct),
        },
      ],
      { stateCode: "27", registrationType: "regular" },
      { stateCode: customer.state },
    );

    await insertInvoiceCreatedEvent({
      businessId,
      invoiceId,
      actor: `user:${userId}`,
      atIso: "2026-10-02T10:00:00+05:30",
      number,
      customerId: custId,
      items: [
        {
          description: item.description,
          hsnSac: item.hsn_sac,
          qty: Number(item.qty),
          unit: item.unit,
          ratePaise: item.rate_paise,
          discountPaise: item.discount_paise,
          gstRatePct: Number(item.gst_rate_pct),
        },
      ],
      totals,
    });

    return { number, invoiceId, totals };
  }

  const fx41 = await seedFixture({
    seq: 41,
    customerIdx: 1,
    description: "Matcher fixture: partial payment target",
    taxablePaise: 6_000_000,
  });
  const fx42 = await seedFixture({
    seq: 42,
    customerIdx: 2,
    description: "Matcher fixture: multi-invoice part 1",
    taxablePaise: 3_500_000,
  });
  const fx43 = await seedFixture({
    seq: 43,
    customerIdx: 2,
    description: "Matcher fixture: multi-invoice part 2",
    taxablePaise: 2_000_000,
  });
  const fx44 = await seedFixture({
    seq: 44,
    customerIdx: 3,
    description: "Matcher fixture: TDS target",
    taxablePaise: 7_000_000,
  });
  const fx45 = await seedFixture({
    seq: 45,
    customerIdx: 4,
    description: "Matcher fixture: overpayment target",
    taxablePaise: 2_000_000,
  });

  console.log("  Fixture totals (paise):");
  console.log(`    0041  total ${fx41.totals.totalPaise}  part target`);
  console.log(`    0042  total ${fx42.totals.totalPaise}  multi part 1`);
  console.log(`    0043  total ${fx43.totals.totalPaise}  multi part 2`);
  console.log(`    0042+0043 = ${fx42.totals.totalPaise + fx43.totals.totalPaise}  multi test`);
  console.log(`    0044  total ${fx44.totals.totalPaise}  taxable ${fx44.totals.taxablePaise}`);
  console.log(
    `          2% TDS shortfall = ${Math.round((fx44.totals.taxablePaise * 2) / 100)}  → credit ${fx44.totals.totalPaise - Math.round((fx44.totals.taxablePaise * 2) / 100)}`,
  );
  console.log(`    0045  total ${fx45.totals.totalPaise}  overpayment target (credit > this)`);

  // ─── Expenses ────────────────────────────────────────────────
  console.log("Seeding expenses…");
  // "Diwali stock buildup" is the week-6 lever — a real festival-season purchase
  // that produces the cash dip the design doc targets. Tune up/down if the
  // breach week drifts from 6.
  const expenseRows = [
    { label: "Salaries", category: "salary", amount: 480000, due: "2026-11-01" },
    { label: "Rent", category: "rent", amount: 85000, due: "2026-11-05" },
    { label: "Electricity", category: "utility", amount: 22000, due: "2026-11-10" },
    { label: "GST payment", category: "gst", amount: 120000, due: "2026-11-20" },
    { label: "Paper supplier", category: "supplier", amount: 60000, due: "2026-11-28" },
    { label: "Ink supplier", category: "supplier", amount: 35000, due: "2026-12-03" },
    { label: "Dec Salaries", category: "salary", amount: 480000, due: "2026-12-01" },
    { label: "Dec Rent", category: "rent", amount: 85000, due: "2026-12-05" },
    { label: "Diwali stock buildup", category: "supplier", amount: 1200000, due: "2026-12-07" },
    {
      label: "Paper reorder (week 6 force)",
      category: "supplier",
      amount: 600000,
      due: "2026-12-08",
    },
    { label: "Dec Electricity", category: "utility", amount: 22000, due: "2026-12-10" },
    { label: "Dec GST", category: "gst", amount: 120000, due: "2026-12-20" },
  ];

  for (const e of expenseRows) {
    await sql`
      INSERT INTO expenses (
        business_id, label, category, amount_paise, recurrence, due_date
      ) VALUES (
        ${businessId}, ${e.label}, ${e.category}, ${e.amount * 100}, 'once', ${e.due}
      )
    `;
  }

  // ─── Summary ─────────────────────────────────────────────────
  const [{ count: invoiceCount }] = await sql`SELECT COUNT(*)::int FROM invoices`;
  const [{ count: itemCount }] = await sql`SELECT COUNT(*)::int FROM invoice_items`;
  const [{ count: eventCount }] = await sql`SELECT COUNT(*)::int FROM events`;
  const [{ count: paymentCount }] = await sql`SELECT COUNT(*)::int FROM payments`;

  // Idempotent app-role grants.
  await sql`GRANT USAGE ON SCHEMA public TO baaki_app`;
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO baaki_app`;
  await sql`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO baaki_app`;
  await sql`REVOKE UPDATE, DELETE ON events FROM baaki_app`;
  await sql`GRANT SELECT, INSERT ON events TO baaki_app`;
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO baaki_app`;
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO baaki_app`;

  console.log("Seed complete.");
  console.log(`  Business:    Sharma Packaging (${businessId})`);
  console.log(`  Owner:       Rakesh Sharma (${userId})`);
  console.log(`  Customers:   ${customers.length}`);
  console.log(`  Invoices:    ${invoiceCount} (40 base + 5 matcher fixtures)`);
  console.log(`  Items:       ${itemCount}`);
  console.log(`  Payments:    ${paymentCount} (seeded for paid/part-paid invoices)`);
  console.log(`  Events:      ${eventCount} (INVOICE_CREATED + PAYMENT_CONFIRMED)`);
  console.log(`  Expenses:    ${expenseRows.length}`);
  console.log("");
  console.log("Demo invoice: INV/26-27/0012 · ₹1,18,000 total · ₹1,18,000 outstanding");
  console.log("Anchor date: " + todayStr);
}

try {
  await main();
} catch (err) {
  console.error("Seed failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}
