import type { BankLine } from "@/lib/domain/matcher";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

const ALLOWED_COLUMNS = new Set([
  "date",
  "description",
  "credit_paise",
  "debit_paise",
  "ref",
]);

export type ParseResult =
  | { ok: true; lines: BankLine[] }
  | { ok: false; error: string; code: string };

function splitCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      current.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      current.push(field);
      if (current.some((f) => f.length > 0)) rows.push(current);
      current = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    if (current.some((f) => f.length > 0)) rows.push(current);
  }
  return rows;
}

export function parseBankStatement(text: string): ParseResult {
  if (typeof text !== "string") {
    return { ok: false, error: "Body must be a string.", code: "BAK-PAY-002" };
  }
  if (text.length > MAX_BYTES) {
    return { ok: false, error: "File exceeds 5 MB.", code: "BAK-PAY-002" };
  }

  const rows = splitCSV(text);
  if (rows.length === 0) {
    return { ok: false, error: "Empty file.", code: "BAK-PAY-002" };
  }

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  for (const col of header) {
    if (!ALLOWED_COLUMNS.has(col)) {
      return {
        ok: false,
        error: `Unknown column "${col}". Allowed: ${[...ALLOWED_COLUMNS].join(", ")}.`,
        code: "BAK-PAY-002",
      };
    }
  }
  const idx = {
    date: header.indexOf("date"),
    description: header.indexOf("description"),
    credit: header.indexOf("credit_paise"),
    debit: header.indexOf("debit_paise"),
    ref: header.indexOf("ref"),
  };
  if (idx.date < 0 || idx.description < 0 || idx.credit < 0 || idx.debit < 0) {
    return {
      ok: false,
      error: "Required columns: date, description, credit_paise, debit_paise.",
      code: "BAK-PAY-002",
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_ROWS) {
    return {
      ok: false,
      error: `File exceeds ${MAX_ROWS} rows.`,
      code: "BAK-PAY-002",
    };
  }

  const lines: BankLine[] = [];
  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r]!;
    const rowNum = r + 2;
    const date = (row[idx.date] ?? "").trim();
    const description = (row[idx.description] ?? "").trim();
    const creditStr = (row[idx.credit] ?? "").trim();
    const debitStr = (row[idx.debit] ?? "").trim();
    const ref = idx.ref >= 0 ? (row[idx.ref] ?? "").trim() : "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        ok: false,
        error: `Row ${rowNum}: date must be YYYY-MM-DD.`,
        code: "BAK-PAY-002",
      };
    }
    const credit = Number(creditStr || "0");
    const debit = Number(debitStr || "0");
    if (!Number.isInteger(credit) || credit < 0) {
      return {
        ok: false,
        error: `Row ${rowNum}: credit_paise must be a non-negative integer.`,
        code: "BAK-PAY-002",
      };
    }
    if (!Number.isInteger(debit) || debit < 0) {
      return {
        ok: false,
        error: `Row ${rowNum}: debit_paise must be a non-negative integer.`,
        code: "BAK-PAY-002",
      };
    }
    if (credit === 0 && debit === 0) continue;

    lines.push({
      id: `row-${rowNum}`,
      date,
      description,
      creditPaise: credit,
      ref,
    });
  }

  return { ok: true, lines };
}
