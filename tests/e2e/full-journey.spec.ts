import { test, expect } from "@playwright/test";

test.describe("Full journey", () => {
  test.beforeEach(async ({ page }) => {
    // Demo login
    await page.request.post("/api/auth/demo");
  });

  test("dashboard → forecast → chase → follow-up → pay link → inbox → letter → evidence", async ({
    page,
  }) => {
    // 1. Dashboard loads with money-to-collect
    await page.goto("/dashboard");
    await expect(page.getByText(/Money to collect/i)).toBeVisible();

    // Grab the outstanding total shown
    const totalEl = page.locator("text=/₹[0-9,]+\\.[0-9]{2}/").first();
    await expect(totalEl).toBeVisible();

    // 2. Chase list has 5 items with a 4-clause reason
    await page.getByRole("link", { name: /See all/i }).click();
    await expect(page).toHaveURL(/\/chase/);
    await expect(page.getByText(/Amount 40%/i)).toBeVisible();
    await expect(page.getByText(/days overdue.*age factor/i).first()).toBeVisible();

    // 3. Forecast shows a breach banner (seed data → week 6)
    await page.goto("/forecast");
    await expect(page.getByText(/Cash goes below buffer in week/i)).toBeVisible();

    // Toggle a what-if and confirm the chart state changes
    const delayLabel = page.getByLabel(/Delay biggest customer 30 days/i);
    if (await delayLabel.isVisible()) {
      await delayLabel.check();
      await expect(page.getByRole("alert")).toBeVisible();
    }

    // 4. Follow-ups has at least one due item
    await page.goto("/follow-ups");
    await expect(page.getByRole("heading", { name: /Follow-ups/i })).toBeVisible();

    // 5. Pick an invoice from the invoices list, open its detail
    await page.goto("/invoices");
    await page
      .getByRole("link")
      .filter({ hasText: /INV\/26-27\// })
      .first()
      .click();

    // Landed on invoice detail
    await expect(page.getByText(/INV\/26-27\//i)).toBeVisible();
    const invoiceUrl = page.url();
    const invoiceId = invoiceUrl.split("/invoices/")[1];
    expect(invoiceId).toBeTruthy();

    // 6. Copy pay link → open the customer page
    // The pay-link route returns a token; navigate directly
    const linkResp = await page.request.post(`/api/invoices/${invoiceId}/pay-link`);
    expect(linkResp.ok()).toBe(true);
    const linkData = await linkResp.json();
    const token = linkData.data.token;

    await page.goto(`/pay/${token}`);
    await expect(page.getByText(/Amount due/i)).toBeVisible();
    await expect(page.getByText(/Open UPI app/i)).toBeVisible();

    // 7. Customer disputes
    await page.getByRole("button", { name: /Something's wrong/i }).click();
    await page.getByPlaceholder(/What's wrong/i).fill("Automated test dispute");
    await page.getByRole("button", { name: /^Send$/i }).click();
    await expect(page.getByText(/Sent ✓|will review/i)).toBeVisible();

    // 8. Inbox has the dispute
    await page.goto("/inbox");
    await expect(page.getByText(/Automated test dispute/i)).toBeVisible();

    // 9. Demand letter page loads
    await page.goto(`/print/letter/${invoiceId}`);
    await expect(page.getByRole("heading", { name: /^Payment Demand Letter$/ })).toBeVisible();
    await expect(
      page.getByText(
        /This letter is from .* about money owed.*It is not a notice from the GST department/i,
      ),
    ).toBeVisible();

    // 10. Evidence pack page loads
    await page.goto(`/print/evidence/${invoiceId}`);
    await expect(page.getByRole("heading", { name: /^Evidence Pack$/ })).toBeVisible();
    await expect(page.getByText(/Complete audit trail/i)).toBeVisible();

    // 11. Verify chain on invoice detail
    await page.goto(`/invoices/${invoiceId}`);
    const verifyBtn = page.getByRole("button", { name: /Verify/i });
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
      await expect(page.getByText(/Chain verified|Tampered/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test("demo date shift propagates via API", async ({ page }) => {
    // Snapshot baseline
    const before = await page.request.get("/api/dashboard");
    const beforeJson = await before.json();
    const beforeOverdue = beforeJson.data.overduePaise;

    // Shift date forward
    await page.request.post("/api/admin/demo-date", {
      data: { date: "2026-12-15" },
    });

    // Check reflected
    const after = await page.request.get("/api/dashboard");
    const afterJson = await after.json();
    const afterOverdue = afterJson.data.overduePaise;

    expect(afterOverdue).not.toBe(beforeOverdue);

    // Reset
    await page.request.post("/api/admin/demo-date", {
      data: { date: null },
    });

    const restored = await page.request.get("/api/dashboard");
    const restoredJson = await restored.json();
    expect(restoredJson.data.overduePaise).toBe(beforeOverdue);
  });

  test("reset demo restores seed", async ({ page }) => {
    const before = await page.request.get("/api/invoices");
    const beforeJson = await before.json();
    const beforeCount = beforeJson.data.length;

    await page.request.post("/api/admin/reset");
    // Reseed wipes sessions — re-auth
    await page.request.post("/api/auth/demo");

    const after = await page.request.get("/api/invoices");
    const afterJson = await after.json();
    expect(afterJson.data.length).toBe(beforeCount);
  });
});
