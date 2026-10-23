#!/usr/bin/env bun
// Enforces Product Spec §1.3 / Checklist Phase 12:
//   - "court", "emblem", "seal"  → zero occurrences anywhere in src/
//   - "legal notice"            → exactly once, inside the disclaimer file

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ALLOWED_LEGAL_NOTICE_FILE = "src/app/print/letter/[id]/page.tsx";
const FORBIDDEN = ["court", "emblem", "seal"];
const LEGAL_NOTICE = "legal notice";

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
    else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) yield p;
  }
}

const violations = [];
let legalNoticeCount = 0;

for await (const file of walk("src")) {
  const text = (await readFile(file, "utf8")).toLowerCase();
  for (const token of FORBIDDEN) {
    if (text.includes(token)) {
      violations.push(`${file}: forbidden token "${token}"`);
    }
  }
  if (text.includes(LEGAL_NOTICE)) {
    if (file.replace(/\\/g, "/") === ALLOWED_LEGAL_NOTICE_FILE) {
      legalNoticeCount += text.split(LEGAL_NOTICE).length - 1;
    } else {
      violations.push(`${file}: "legal notice" outside the disclaimer file`);
    }
  }
}

if (legalNoticeCount > 1) {
  violations.push(`"legal notice" appears ${legalNoticeCount}× in disclaimer; must be ≤ 1`);
} else if (legalNoticeCount === 0) {
  console.warn("WARN: 'legal notice' disclaimer not yet written — becomes required at Phase 12.");
}

if (violations.length) {
  console.error("Forbidden-token check FAILED:");
  for (const v of violations) console.error("  -", v);
  process.exit(1);
}
console.log(`Forbidden-token check passed (legal notice ×${legalNoticeCount}).`);
