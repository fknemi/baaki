#!/usr/bin/env bun
// Scans .next/ for any secret value. Fails the build if a server-side secret
// has leaked into the client bundle or static output.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const SECRET_NAMES = [
  "DATABASE_URL",
  "DATABASE_URL_APP",
  "AUTH_SECRET",
  "CRON_SECRET",
  "FIREBASE_PRIVATE_KEY",
  "RESEND_API_KEY",
  "GEMINI_API_KEY",
  "R2_SECRET_ACCESS_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
];

const secrets = SECRET_NAMES.map((n) => process.env[n]).filter(
  (v) => typeof v === "string" && v.length >= 8,
);

if (!secrets.length) {
  console.warn("No secrets present in env — skipping secret scan.");
  process.exit(0);
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
    else yield p;
  }
}

let hits = 0;
for await (const file of walk(".next")) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    continue;
  }
  for (const s of secrets) {
    if (text.includes(s)) {
      console.error(`Secret leaked into ${file}`);
      hits++;
      break;
    }
  }
}

if (hits) {
  console.error(`Secret scan FAILED: ${hits} file(s) contained secret values.`);
  process.exit(1);
}
console.log(`Secret scan passed across .next/ (${secrets.length} secrets checked).`);
