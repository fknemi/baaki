import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,

    // Only run unit tests in src/. E2E tests live in tests/e2e/
    // and are run via Playwright (`bun test:e2e`), not vitest.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules",
      "dist",
      ".next",
      "tests/e2e",
      "tests/e2e/**",
      "playwright-report",
      "test-results",
    ],

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: ["src/lib/**"],
      exclude: ["src/lib/**/__tests__/**", "src/lib/**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
