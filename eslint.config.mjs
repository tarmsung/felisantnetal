import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright's own generated output (Phase 10) — bundled trace-viewer
    // JS and per-test artifacts, not source, but nothing above already
    // excluded it and `npm run lint` was linting minified vendor code as
    // a result the first time this repo actually had E2E output to find.
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
