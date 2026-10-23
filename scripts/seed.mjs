#!/usr/bin/env bun
// Seeds demo data. Requires DATABASE_URL_APP or DATABASE_URL in env.
// Run with: bun seed

import postgres from "postgres";
import { randomUUID } from "node:crypto";

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

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 5 });

try {
    console.log("Clearing existing data…");
    await sql`TRUNCATE TABLE
    inbox_items, payments, reminder_log, invoice_items, invoices,
    evidence_files, expenses, customers, business_members,
    businesses, users
    RESTART IDENTITY CASCADE`;
    // events is append-only — do not truncate it via the app role.
    // (Run this seed with DATABASE_URL=owner; owner can disable the trigger.)

    console.log("Seeding user + business…");
    const userId = randomUUID();
    const businessId = randomUUID();

    await sql`INSERT INTO users (id, phone_e164, name) VALUES (${userId}, '+919800000001', 'Rakesh Sharma')`;

    await sql`
    INSERT INTO businesses (
      id, owner_id, name, address_json, gstin, registration_type,
      turnover_paise, ever_crossed_einvoice_threshold, udyam_registered,
      udyam_type, bank_json, upi_id, safety_buffer_paise, opening_cash_paise
    ) VALUES (
      ${businessId}, ${userId}, 'Sharma Packaging',
      ${sql.json({ line1: '123 Industrial Area', city: 'Pune', state: 'Maharashtra', stateCode: '27', pincode: '411001' })},
      '27AAPFU0939F1ZV', 'regular',
      420000000, false, true, 'micro',
      ${sql.json({ accountName: 'Sharma Packaging', accountNumberMasked: 'XXXX XXXX 4821', ifsc: 'HDFC0001234', bankName: 'HDFC Bank' })},
      'sharmapackaging@okokhdfcbank',
      30000000, 85000000
    )`;

    await sql`INSERT INTO business_members (business_id, user_id, role, accepted_at) VALUES (${businessId}, ${userId}, 'owner', now())`;

    console.log("Seeding 12 customers…");
    const customers = [
        { name: "Krishna Traders", pan: "BBBPK1234K", state: "27", stateName: "Maharashtra", city: "Pune", lang: "en" },
        { name: "Patel Brothers", pan: "AABCP5678P", state: "24", stateName: "Gujarat", city: "Ahmedabad", lang: "hi" },
        { name: "Sunrise Agencies", pan: "AABCS9012S", state: "29", stateName: "Karnataka", city: "Bengaluru", lang: "en" },
        { name: "Mehta & Co", pan: "AABCM3456M", state: "27", stateName: "Maharashtra", city: "Mumbai", lang: "en" },
        { name: "Royal Industries", pan: "AABCR7890R", state: "27", stateName: "Maharashtra", city: "Pune", lang: "en" },
        { name: "Delhi Distributors", pan: "AABCD2345D", state: "07", stateName: "Delhi", city: "Delhi", lang: "hi" },
        { name: "Mumbai Supplies", pan: "AABCM6789M", state: "27", stateName: "Maharashtra", city: "Mumbai", lang: "hi" },
        { name: "Bangalore Boxes", pan: "AABCB1357B", state: "29", stateName: "Karnataka", city: "Bengaluru", lang: "en" },
        { name: "Chennai Traders", pan: "AABCT2468T", state: "33", stateName: "Tamil Nadu", city: "Chennai", lang: "en" },
        { name: "Hyderabad Hub", pan: "AABCH3579H", state: "36", stateName: "Telangana", city: "Hyderabad", lang: "en" },
        { name: "Kolkata Kart", pan: "AABCK4680K", state: "19", stateName: "West Bengal", city: "Kolkata", lang: "hi" },
        { name: "Gujarat Traders", pan: "AABCG5791G", state: "24", stateName: "Gujarat", city: "Surat", lang: "hi" },
    ];

    const customerIds = [];
    for (let i = 0; i < customers.length; i++) {
        const c = customers[i];
        const g = gstin(`${c.state}${c.pan}1Z`);
        const id = randomUUID();
        customerIds.push(id);
        await sql`
      INSERT INTO customers (
        id, business_id, name, gstin, state_code, place_of_supply_state,
        city, phone_masked, email, credit_days, preferred_language, pay_token
      ) VALUES (
        ${id}, ${businessId}, ${c.name}, ${g}, ${c.state}, ${c.stateName},
        ${c.city}, ${"+91 98XXX XX" + String(100 + i)}, ${`contact${i + 1}@example.test`},
        30, ${c.lang}, ${`tok-${i + 1}`}
      )`;
    }

    console.log("Seeding 40 invoices…");
    // Mix per spec §6.3: 8 paid, 5 part-paid, 6 due-soon, 14 overdue, 1 disputed, 2 draft, 4 sent
    const invoicePlan = [
        ...Array(8).fill("paid"),
        ...Array(5).fill("part-paid"),
        ...Array(6).fill("due-soon"),
        ...Array(14).fill("overdue"),
        "disputed",
        ...Array(2).fill("draft"),
        ...Array(4).fill("sent"),
    ];

    let seq = 1;
    const today = new Date("2026-11-01");

    for (let i = 0; i < invoicePlan.length; i++) {
        const kind = invoicePlan[i];
        const custId = customerIds[i % customerIds.length];
        const number = `INV/26-27/${String(seq++).padStart(4, "0")}`;
        const amount = 25000 + (i * 3000); // ₹25k, ₹28k, ₹31k… rounds out to ~₹11L total

        let dueOffset;
        let paid = 0;
        if (kind === "paid") { dueOffset = -45 - i; paid = amount * 100; }
        else if (kind === "part-paid") { dueOffset = -20 - i; paid = Math.floor(amount * 100 * 0.4); }
        else if (kind === "due-soon") { dueOffset = 3 + (i % 5); }
        else if (kind === "overdue") { dueOffset = -5 - (i * 4); }
        else if (kind === "disputed") { dueOffset = -30; }
        else if (kind === "draft") { dueOffset = 20; }
        else { dueOffset = 10 + i; }

        const invoiceDate = new Date(today); invoiceDate.setDate(today.getDate() + dueOffset - 30);
        const dueDate = new Date(today); dueDate.setDate(today.getDate() + dueOffset);

        const invoiceId = randomUUID();
        await sql`
      INSERT INTO invoices (
        id, business_id, customer_id, number, invoice_date, due_date,
        place_of_supply_state_code, status, amount_paid_paise, disputed
      ) VALUES (
        ${invoiceId}, ${businessId}, ${custId}, ${number},
        ${invoiceDate.toISOString().split("T")[0]},
        ${dueDate.toISOString().split("T")[0]},
        '27', ${kind === "draft" ? "draft" : "sent"}, ${paid},
        ${kind === "disputed"}
      )`;

        // Single line item per invoice
        await sql`
      INSERT INTO invoice_items (
        invoice_id, description, hsn_sac, qty, unit, rate_paise, discount_paise, gst_rate_pct
      ) VALUES (
        ${invoiceId}, 'Corrugated box 12x12', '4819', 100, 'pcs',
        ${Math.floor(amount / 1.18)}, 0, 18
      )`;

        // Pay token needs to be set on the customer already, no per-invoice action
    }

    console.log("Seeding expenses…");
    const expenseRows = [
        { label: "Salaries", category: "salary", amount: 480000, due: "2026-11-01" },
        { label: "Rent", category: "rent", amount: 85000, due: "2026-11-05" },
        { label: "Electricity", category: "utility", amount: 22000, due: "2026-11-10" },
        { label: "GST payment", category: "gst", amount: 120000, due: "2026-11-20" },
        { label: "Paper supplier", category: "supplier", amount: 60000, due: "2026-11-28" },
        { label: "Ink supplier", category: "supplier", amount: 35000, due: "2026-12-03" },
        { label: "Dec Salaries", category: "salary", amount: 480000, due: "2026-12-01" },
        { label: "Dec Rent", category: "rent", amount: 85000, due: "2026-12-05" },
        { label: "Paper reorder", category: "supplier", amount: 600000, due: "2026-12-08" }, // week 6 force
        { label: "Dec Electricity", category: "utility", amount: 22000, due: "2026-12-10" },
        { label: "Dec GST", category: "gst", amount: 120000, due: "2026-12-20" },
    ];

    for (const e of expenseRows) {
        await sql`
      INSERT INTO expenses (
        business_id, label, category, amount_paise, recurrence, due_date
      ) VALUES (
        ${businessId}, ${e.label}, ${e.category}, ${e.amount * 100}, 'once', ${e.due}
      )`;
    }

    console.log("Seed complete.");
    console.log(`  Business: Sharma Packaging (${businessId})`);
    console.log(`  Customers: ${customers.length}`);
    console.log(`  Invoices: ${invoicePlan.length}`);
    console.log(`  Expenses: ${expenseRows.length}`);
} catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
} finally {
    await sql.end();
}
