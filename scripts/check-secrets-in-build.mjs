#!/usr/bin/env bun
// Scans the CLIENT bundle for server-only secrets.
// Server chunks legitimately contain inlined env values (via Turbopack) — those
// are not exposed to the browser, only to the Node runtime. The gate is: no
// server-only secret appears in a JS file the browser downloads.

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

// Only files under these directories ship to the browser.
// `_next/static` is the production client bundle. `.next/dev/static` is the
// dev equivalent. `_next/server` and `.next/server` are server-only.
const CLIENT_ROOTS = [".next/static", ".next/dev/static"];

// Env vars that MUST NOT appear in the client bundle, ever.
// Do NOT include NEXT_PUBLIC_* — those are meant to be public.
const SERVER_ONLY_SECRETS = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "AUTH_SECRET",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "R2_SECRET_ACCESS_KEY",
  "DATABASE_URL",
  "DATABASE_URL_APP",
];

// Also scan for the *value* of each secret. If we find `AIzaSy...` in a
// client chunk, that's a real leak even if the key name isn't there.
async function loadSecretValues() {
  const values = new Map();
  for (const file of [".env.local", ".env"]) {
    try {
      const content = await readFile(file, "utf8");
      for (const line of content.split("\n")) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (!match) continue;
        const [, key, rawVal] = match;
        const val = rawVal.trim().replace(/^["']|["']$/g, "");
        if (!val || val.length < 8) continue;
        if (SERVER_ONLY_SECRETS.includes(key)) {
          values.set(key, val);
        }
      }
    } catch {
      // .env.local may not exist; fine
    }
  }
  return values;
}

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(js|mjs|cjs)$/.test(e.name)) yield p;
  }
}

const secretValues = await loadSecretValues();
const violations = [];
let filesScanned = 0;

for (const root of CLIENT_ROOTS) {
  try {
    await stat(root);
  } catch {
    continue; // root doesn't exist; skip
  }
  for await (const file of walk(root)) {
    filesScanned++;
    const text = await readFile(file, "utf8");

    // Check 1: variable name appears
    for (const name of SERVER_ONLY_SECRETS) {
      if (text.includes(name)) {
        violations.push(`${file}: contains secret variable name "${name}"`);
      }
    }

    // Check 2: actual value appears
    for (const [name, value] of secretValues) {
      if (text.includes(value)) {
        violations.push(
          `${file}: contains value of ${name} (first 8 chars: ${value.slice(0, 8)}…)`,
        );
      }
    }
  }
}

if (filesScanned === 0) {
  console.warn("⚠ No client bundle found. Run 'bun run build' first.");
  console.warn("  Client dirs checked: " + CLIENT_ROOTS.join(", "));
  process.exit(0);
}

if (violations.length > 0) {
  console.error("Secret scan FAILED — server-only values found in client bundle:");
  for (const v of violations) console.error("  -", v);
  process.exit(1);
}

console.log(
  `Secret scan passed (${filesScanned} client files, ${SERVER_ONLY_SECRETS.length} secret names checked).`,
);
