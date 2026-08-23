import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. The primary workflows in spec section 30 ("Workflow 1"
 * through "Workflow 10") each need a real auth session and, for the
 * ones that create data, a live Supabase project to clean up after
 * themselves in — they were added phase by phase as those features
 * landed, with Phase 10 the point where enough of the app existed to
 * make covering them worthwhile (see e2e/helpers.ts and the specs
 * alongside this file). Phase 5 (WhatsApp reminders) has no spec here:
 * it's deferred and not yet implemented. This config + the smoke test
 * in e2e/login.spec.ts exist from Phase 1, so the harness itself was
 * proven working before there was much to test.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Capped rather than left at the CPU-core default (Phase 10 finding):
  // every spec here hits a real Supabase project and a single `next
  // start` process, not a mock — enough concurrent workers made that one
  // process's response times marginal against a tight assertion timeout
  // and produced a flaky (not deterministic) failure. Two keeps some
  // parallelism without that contention.
  workers: 2,
  forbidOnly: !!process.env.CI,
  // Real-network flakiness (a slightly slow round trip past this file's
  // one 5s-timeout assertion) is a known, accepted class of flake for
  // tests that hit a live external service — one retry locally too, not
  // just in CI, rather than only ever chasing it with longer timeouts.
  retries: process.env.CI ? 2 : 1,
  reporter: "html",
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
