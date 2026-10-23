#!/usr/bin/env bun
// Requires `bun` — uses Bun's native TS resolution to import src/lib/i18n/*.ts.
// Fails the build if EN/HI key trees differ.

async function load(tree) {
  const mod = await import(`../src/lib/i18n/${tree}`);
  return mod.default ?? mod;
}

function flatten(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) keys.push(...flatten(v, full));
    else keys.push(full);
  }
  return keys;
}

const en = await load("en");
const hi = await load("hi");

const enKeys = new Set(flatten(en));
const hiKeys = new Set(flatten(hi));

const missingInHi = [...enKeys].filter((k) => !hiKeys.has(k));
const missingInEn = [...hiKeys].filter((k) => !enKeys.has(k));

if (missingInHi.length || missingInEn.length) {
  if (missingInHi.length) {
    console.error(`Missing in hi.ts (${missingInHi.length}):`);
    for (const k of missingInHi) console.error("  -", k);
  }
  if (missingInEn.length) {
    console.error(`Missing in en.ts (${missingInEn.length}):`);
    for (const k of missingInEn) console.error("  -", k);
  }
  process.exit(1);
}

console.log(`i18n parity OK (${enKeys.size} keys).`);
