#!/usr/bin/env bun
import { en } from "../src/lib/i18n/en.ts";
import { hi } from "../src/lib/i18n/hi.ts";

const enKeys = new Set(Object.keys(en));
const hiKeys = new Set(Object.keys(hi));

const missingInHi = [...enKeys].filter((k) => !hiKeys.has(k));
const missingInEn = [...hiKeys].filter((k) => !enKeys.has(k));

let failed = false;

if (missingInHi.length) {
  console.error(`Missing in hi.ts (${missingInHi.length}):`);
  for (const k of missingInHi) console.error("  -", k);
  failed = true;
}

if (missingInEn.length) {
  console.error(`Missing in en.ts (${missingInEn.length}):`);
  for (const k of missingInEn) console.error("  -", k);
  failed = true;
}

if (failed) process.exit(1);
console.log(`i18n parity OK (${enKeys.size} keys).`);
