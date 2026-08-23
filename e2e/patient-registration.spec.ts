import { test, expect } from "@playwright/test";
import {
  createSupabaseAdminClient,
  getAnyActiveCommunityHealthWorkerId,
  login,
  e2eTag,
  futureDateOnly,
  softDeleteTestPatient,
} from "./helpers";

/**
 * Requires:
 *  - .env.local pointed at a real Supabase project (see e2e/login.spec.ts).
 *  - E2E_NURSE_EMAIL / E2E_NURSE_PASSWORD for a disposable staff account
 *    (see e2e/helpers.ts's `login` — registering a patient doesn't
 *    require an administrator, so this uses the nurse role tests skip
 *    with a clear message if these aren't set.
 *  - At least one active community health worker already on file.
 *    Every registration requires picking one (see
 *    lib/validation/patientSchemas.ts), and community_health_workers
 *    rows can never be hard-deleted (migration 0007) — so this suite
 *    deliberately does not create one itself; it reuses whatever the
 *    project already has and skips with a clear message if there is
 *    none, rather than leaving a permanent CHW row behind.
 *
 * Cleanup: every patient registered here is soft-deleted via the
 * service-role admin client in `afterEach` — patients can't be
 * hard-deleted either (same migration); see helpers.ts's
 * `softDeleteTestPatient` for exactly why and what residue that leaves.
 * Using `afterEach` (rather than the end of the test body) means a
 * failed assertion mid-test still triggers cleanup.
 */
test.describe("patient registration", () => {
  // Constructed inside a hook, not at module scope: if
  // SUPABASE_SERVICE_ROLE_KEY isn't set, this should surface as a
  // normal failed-hook message for this file, not an import-time crash
  // that could disrupt the whole suite's test collection.
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  let chwId: string | null = null;
  const createdPatientIds: string[] = [];

  test.beforeEach(async () => {
    admin = createSupabaseAdminClient();
    chwId = await getAnyActiveCommunityHealthWorkerId(admin);
    createdPatientIds.length = 0;
  });

  test.afterEach(async () => {
    for (const id of createdPatientIds) {
      await softDeleteTestPatient(admin, id);
    }
  });

  test("registers a new patient with the minimum required fields", async ({ page }) => {
    test.skip(
      !chwId,
      "No active community health worker on file — add one via /community-health-workers first.",
    );
    await login(page, "nurse");

    const fullName = e2eTag("Register");

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(fullName);

    await page.getByLabel("Community health worker").click();
    await page.getByRole("option").first().click();

    await page.getByLabel("Estimated date of delivery (EDD)").fill(futureDateOnly(200));

    await page.getByRole("button", { name: "Register patient" }).click();

    // registerPatientAction redirects to the new patient's profile on success.
    await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const patientId = page.url().split("/").pop()!;
    createdPatientIds.push(patientId);

    // level: 1 — the patient's name also appears in an <h2> further down
    // the page (the overview card repeats it), so a bare name match is
    // ambiguous. The page header <h1> is the one that's always there.
    await expect(page.getByRole("heading", { name: fullName, level: 1 })).toBeVisible();

    // Also confirm it's findable from the patient list, not just its own page.
    await page.goto("/patients");
    await page.getByLabel("Search patients").fill(fullName);
    await expect(page.getByRole("link", { name: new RegExp(fullName) })).toBeVisible();
  });

  test("surfaces a duplicate-check dialog instead of silently creating a second patient", async ({
    page,
  }) => {
    test.skip(
      !chwId,
      "No active community health worker on file — add one via /community-health-workers first.",
    );
    await login(page, "nurse");

    const fullName = e2eTag("Duplicate");
    const nationalId = e2eTag("NatID");
    const edd = futureDateOnly(200);

    async function fillMinimumFields() {
      await page.getByLabel("Full name").fill(fullName);
      await page.getByLabel("National ID").fill(nationalId);
      await page.getByLabel("Community health worker").click();
      await page.getByRole("option").first().click();
      await page.getByLabel("Estimated date of delivery (EDD)").fill(edd);
    }

    // First registration: goes through cleanly, no existing match yet.
    await page.goto("/patients/new");
    await fillMinimumFields();
    await page.getByRole("button", { name: "Register patient" }).click();
    await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const firstPatientId = page.url().split("/").pop()!;
    createdPatientIds.push(firstPatientId);

    // Second attempt with the same National ID: checkDuplicatePatients
    // (lib/services/patientService.ts) should find the first patient and
    // registerPatientAction should return `status: "duplicates"` instead
    // of inserting — surfacing DuplicateWarningDialog rather than
    // silently creating a second patient row.
    await page.goto("/patients/new");
    await fillMinimumFields();
    await page.getByRole("button", { name: "Register patient" }).click();

    await expect(page.getByText("Possible existing patient")).toBeVisible();
    await expect(page.getByText(fullName)).toBeVisible();

    // Back out rather than confirming — this must not create a second
    // patient row (there is nothing to clean up for the aborted attempt).
    await page.getByRole("button", { name: "Go back and check" }).click();
    await expect(page.getByText("Possible existing patient")).not.toBeVisible();

    // Confirm only one patient with this National ID actually exists.
    // (National ID itself isn't a visible column — the list shows name
    // and patient number — so this counts result rows rather than
    // matching displayed text.)
    await page.goto("/patients");
    await page.getByLabel("Search patients").fill(nationalId);
    const resultsTable = page.getByRole("table");
    await expect(resultsTable.getByRole("row")).toHaveCount(2); // header row + the one match
  });
});
