import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = [
  "/dashboard",
  "/invoices",
  "/follow-ups",
  "/forecast",
  "/chase",
  "/payments",
  "/inbox",
  "/documents",
  "/settings",
  "/help",
  "/customers",
];

const LANGUAGES = ["en", "hi"] as const;
const VIEWPORTS = [
  { name: "360x100", width: 360, height: 800, textScale: "100%" },
  { name: "360x130", width: 360, height: 800, textScale: "130%" },
  { name: "1280x100", width: 1280, height: 800, textScale: "100%" },
];

test.beforeEach(async ({ page }) => {
  // Log in via demo endpoint
  await page.request.post("/api/auth/demo");
});

for (const route of ROUTES) {
  for (const lang of LANGUAGES) {
    for (const vp of VIEWPORTS) {
      test(`${route} · ${lang} · ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.addInitScript(
          ([l, scale]) => {
            window.localStorage.setItem("baaki.lang", l);
            window.localStorage.setItem(
              "baaki.textSize",
              scale === "130%" ? "130" : "100",
            );
          },
          [lang, vp.textScale] as const,
        );

        await page.goto(route, { waitUntil: "networkidle" });

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        expect(
          results.violations,
          `axe violations at ${route} · ${lang} · ${vp.name}`,
        ).toEqual([]);
      });
    }
  }
}
