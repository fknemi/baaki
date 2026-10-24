import { test } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
const BASELINES = "tests/e2e/goldens";
const GOLDEN_INVOICE_ID = process.env.GOLDEN_INVOICE_ID ?? "";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  if (!existsSync(BASELINES)) mkdirSync(BASELINES, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/auth/demo");
});

async function snapshotPdf(page: Page, url: string, filename: string) {
  await page.goto(url, { waitUntil: "networkidle" });
  // Hide interactive controls for a stable render
  await page.addStyleTag({ content: `.no-print { display: none !important; }` });
  const path = join(BASELINES, filename);
  await page.pdf({
    path,
    format: "A4",
    margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" },
    printBackground: true,
  });
  return path;
}

test.describe("Print goldens", () => {
  test("invoice PDF snapshot", async ({ page }) => {
    const invoiceId = GOLDEN_INVOICE_ID || (await getFirstInvoiceId(page));
    test.skip(!invoiceId, "No invoice available");
    await snapshotPdf(page, `/print/invoice/${invoiceId}`, "invoice.pdf");
  });

  test("letter PDF snapshot", async ({ page }) => {
    const invoiceId = GOLDEN_INVOICE_ID || (await getFirstInvoiceId(page));
    test.skip(!invoiceId, "No invoice available");
    await snapshotPdf(page, `/print/letter/${invoiceId}`, "letter.pdf");
  });

  test("letter PDF snapshot (with interest)", async ({ page }) => {
    const invoiceId = GOLDEN_INVOICE_ID || (await getFirstInvoiceId(page));
    test.skip(!invoiceId, "No invoice available");
    await snapshotPdf(
      page,
      `/print/letter/${invoiceId}?includeInterest=true`,
      "letter-interest.pdf",
    );
  });

  test("evidence PDF snapshot", async ({ page }) => {
    const invoiceId = GOLDEN_INVOICE_ID || (await getFirstInvoiceId(page));
    test.skip(!invoiceId, "No invoice available");
    await snapshotPdf(page, `/print/evidence/${invoiceId}`, "evidence.pdf");
  });
});

async function getFirstInvoiceId(page: Page): Promise<string | null> {
  const res = await page.request.get("/api/invoices");
  if (!res.ok()) return null;
  const json = await res.json();
  return json.data?.[0]?.id ?? null;
}
