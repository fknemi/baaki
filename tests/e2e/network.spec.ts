import { test, expect } from "@playwright/test";

// Endpoints that legitimately leave the origin:
// - Gemini API (AI chat + OCR)
// - SeaweedFS / R2 (presigned URLs for image upload)
const ALLOWED_HOSTS = [
  "localhost:3000",
  "127.0.0.1:3000",
  "localhost:8333",
  "127.0.0.1:8333",
  "10.21.32.244:8333", // LAN IP for SeaweedFS (may or may not be in use)
  "generativelanguage.googleapis.com",
  "firebaseapp.com",
  "googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
];

test.describe("Zero unexpected cross-origin requests", () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post("/api/auth/demo");
  });

  test("dashboard loads without unexpected external calls", async ({ page }) => {
    const violations: string[] = [];

    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url.startsWith("blob:")) return;
      try {
        const parsed = new URL(url);
        const host = parsed.host;
        if (!ALLOWED_HOSTS.some((h) => host.endsWith(h))) {
          violations.push(`${req.method()} ${url}`);
        }
      } catch {
        /* malformed — ignore */
      }
    });

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    expect(violations, `Unexpected outbound requests:\n${violations.join("\n")}`).toEqual([]);
  });

  test("help page loads without unexpected external calls except Gemini", async ({ page }) => {
    const violations: string[] = [];

    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url.startsWith("blob:")) return;
      try {
        const parsed = new URL(url);
        const host = parsed.host;
        if (!ALLOWED_HOSTS.some((h) => host.endsWith(h))) {
          violations.push(`${req.method()} ${url}`);
        }
      } catch {
        /* ignore */
      }
    });

    await page.goto("/help", { waitUntil: "networkidle" });
    expect(violations, `Unexpected outbound requests:\n${violations.join("\n")}`).toEqual([]);
  });
});
