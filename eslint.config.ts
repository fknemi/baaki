import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Product Spec §3.2: module-boundary enforcement, lint-enforced not documented.
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      "import/no-cycle": ["error", { maxDepth: 10, ignoreExternal: true }],
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
