import { test, expect } from "@playwright/test";

/**
 * Requires a configured .env.local (a real Supabase project) — the app
 * can't render at all otherwise, since proxy.ts calls
 * supabase.auth.getUser() on every request. See README.md "Running
 * tests".
 */
test.describe("login page", () => {
  test("renders the sign-in form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Felis Clinic" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("rejects invalid credentials with an inline error, not a crash", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@felisclinic.org");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
