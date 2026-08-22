import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Most of the primary workflows in spec section 30
 * ("Workflow 1" through "Workflow 10") need a seeded database and real
 * auth session and will be added phase by phase as those features land.
 * This config + the smoke test in e2e/login.spec.ts exist from Phase 1
 * so the harness itself is proven working before there's much to test.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
