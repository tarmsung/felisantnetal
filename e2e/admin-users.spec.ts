import { test, expect } from "@playwright/test";
import {
  createSupabaseAdminClient,
  login,
  e2eTag,
  deactivateTestUser,
  tryHardDeleteAuthUser,
} from "./helpers";

/**
 * Requires:
 *  - .env.local pointed at a real Supabase project (see e2e/login.spec.ts).
 *  - E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD for a disposable administrator
 *    account (see e2e/helpers.ts's `login`) — the /users page is
 *    administrator-only (requireAdmin() redirects anyone else to
 *    /dashboard).
 *
 * Cleanup (afterEach, so a failed assertion still runs it):
 *  - the account is deactivated (status: "inactive") via the
 *    service-role admin client. This is the real, durable cleanup step.
 *  - a hard delete of the underlying auth user is also *attempted* via
 *    supabase.auth.admin.deleteUser, but is expected to fail and its
 *    result is not asserted on — see helpers.ts's
 *    `tryHardDeleteAuthUser` for the full explanation: public.users has
 *    a trigger (migration 0007) that blocks ANY delete, even one
 *    reached via auth.users' `on delete cascade`, even for a
 *    service-role connection. A staff account that has ever had a
 *    profile row can never be fully deleted through this schema, by
 *    design — deactivation, not deletion, is the only real "remove this
 *    account" operation this app supports (see ManageUserSheet's
 *    "Active" switch), and the residual account row this test leaves
 *    behind is `E2E-TEST-`-tagged and permanently inactive.
 */
test.describe("admin users management", () => {
  // Constructed inside a hook, not at module scope — see
  // patient-registration.spec.ts's comment for why.
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  let createdUserId: string | null = null;

  test.beforeEach(() => {
    admin = createSupabaseAdminClient();
    createdUserId = null;
  });

  test.afterEach(async () => {
    if (!createdUserId) return;
    await deactivateTestUser(admin, createdUserId);
    await tryHardDeleteAuthUser(admin, createdUserId);
  });

  test("creates a staff account, it appears in the list, and can be deactivated", async ({
    page,
  }) => {
    await login(page, "administrator");

    const fullName = e2eTag("Staff");
    const email = `${e2eTag("staff").toLowerCase()}@example.com`;

    await page.goto("/users");
    await page.getByRole("button", { name: "Add user" }).click();

    await expect(page.getByRole("heading", { name: "Add staff account" })).toBeVisible();
    await page.getByLabel("Full name").fill(fullName);
    await page.getByLabel("Email").fill(email);
    // Role is left at its default ("Nurse") and the temporary password
    // is left at its auto-generated default — both are already valid.

    await page.getByRole("button", { name: "Create account" }).click();

    // Generous timeout: this step is a real auth.admin.createUser() call
    // plus a profile insert, not just a client-side transition.
    await expect(page.getByRole("heading", { name: "Account created" })).toBeVisible({ timeout: 15_000 });
    // exact: true — the dialog's own description prose also contains the
    // email ("Share these credentials with {email}."), so a substring
    // match resolves to two elements; only the credentials display's own
    // text is exactly the email with nothing else around it.
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    // Look the new user up now so cleanup runs even if a later
    // assertion in this test fails.
    const { data: created, error } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();
    expect(error).toBeNull();
    createdUserId = created?.id ?? null;
    expect(createdUserId).not.toBeNull();

    // AddUserDialog's own "Done" button now calls router.refresh()
    // (fixed in this same phase — it didn't before), but an explicit
    // reload here is one less thing for this test to depend on timing
    // for, and costs nothing since production compiles are fast.
    await page.reload();
    await expect(page.getByRole("cell", { name: email })).toBeVisible();

    // Deactivate it through the same UI a real administrator would use.
    await page.getByRole("row", { name: new RegExp(email) }).click();
    await expect(page.getByRole("heading", { name: fullName })).toBeVisible();

    await page.getByRole("switch").click();
    await expect(page.getByText("Account deactivated.")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(
      page
        .getByRole("row", { name: new RegExp(email) })
        .getByText("Inactive"),
    ).toBeVisible();
  });
});
