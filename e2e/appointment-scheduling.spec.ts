import { test, expect } from "@playwright/test";
import {
  createSupabaseAdminClient,
  getAnyActiveCommunityHealthWorkerId,
  login,
  e2eTag,
  futureDateOnly,
  futureLocalDateTime,
  createTestPatientWithPregnancy,
  cancelAllAppointmentsForPatient,
  softDeleteTestPatient,
} from "./helpers";

/**
 * Requires:
 *  - .env.local pointed at a real Supabase project (see e2e/login.spec.ts).
 *  - E2E_NURSE_EMAIL / E2E_NURSE_PASSWORD for a disposable staff account
 *    (see e2e/helpers.ts's `login`) — scheduling an appointment doesn't
 *    require an administrator.
 *  - At least one active community health worker already on file (see
 *    patient-registration.spec.ts's comment for why this suite doesn't
 *    create one itself).
 *
 * The test patient is created directly via the service-role admin
 * client (createTestPatientWithPregnancy, same register_patient()
 * function the UI uses), not through the registration UI — that flow
 * is already covered by patient-registration.spec.ts, and creating it
 * out-of-band keeps this test focused on scheduling.
 *
 * Cleanup (afterEach, so a failed assertion still runs it):
 *  - the appointment is cancelled (not deleted — appointments can't be
 *    hard-deleted either; see helpers.ts's softDeleteTestPatient
 *    comment for the full explanation), via cancelAllAppointmentsForPatient.
 *  - the patient is soft-deleted via softDeleteTestPatient.
 */
test.describe("appointment scheduling", () => {
  // Constructed inside a hook, not at module scope — see
  // patient-registration.spec.ts's comment for why.
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  let chwId: string | null = null;
  let patientId: string | null = null;
  let patientFullName = "";

  test.beforeEach(async () => {
    admin = createSupabaseAdminClient();
    chwId = await getAnyActiveCommunityHealthWorkerId(admin);
    patientId = null;
    patientFullName = "";
  });

  test.afterEach(async () => {
    if (patientId) {
      await cancelAllAppointmentsForPatient(admin, patientId);
      await softDeleteTestPatient(admin, patientId);
    }
  });

  test("schedules an appointment for an existing patient and it shows up on the appointments page", async ({
    page,
  }) => {
    test.skip(
      !chwId,
      "No active community health worker on file — add one via /community-health-workers first.",
    );
    await login(page, "nurse");

    patientFullName = e2eTag("Schedule");
    const created = await createTestPatientWithPregnancy(admin, {
      fullName: patientFullName,
      communityHealthWorkerId: chwId!,
      edd: futureDateOnly(150),
    });
    patientId = created.patientId;

    // Schedule from the patient's own profile — the "Add appointment"
    // dialog opened here preloads the patient (AddAppointmentDialog's
    // `initialPatient` prop), skipping the patient-search step, which
    // keeps this test focused on the scheduling fields themselves.
    await page.goto(`/patients/${patientId}`);
    await page.getByRole("tab", { name: "Appointments" }).click();
    await page.getByRole("button", { name: "Add appointment" }).click();

    await expect(page.getByRole("heading", { name: "Schedule appointment" })).toBeVisible();

    const scheduledFor = futureLocalDateTime(3);
    await page.getByLabel("Date & time").fill(scheduledFor);
    await page.getByRole("button", { name: "Schedule" }).click();

    // Dialog closes and the Appointments tab list refreshes in place.
    // Not "ANC Visit" text — PatientAppointments (see
    // src/components/patients/patient-appointments.tsx) only shows the
    // appointment_type as its label when visit_number is null; here the
    // ANC-schedule suggestion effect populates a visit number, so the
    // list item reads "Visit 1", not "ANC Visit". The status badge is
    // the one thing guaranteed to say "Scheduled" regardless of which
    // label wins that branch.
    // Generous timeout: this is createAppointmentAction's real round trip
    // (insert + audit log write), not a client-side transition — found
    // flaky at the default 5s under concurrent Playwright workers hitting
    // the same single `next start` process (see playwright.config.ts's
    // `workers` comment).
    await expect(page.getByRole("heading", { name: "Schedule appointment" })).not.toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("listitem").getByText("Scheduled")).toBeVisible();

    // Also confirm it shows up on the shared /appointments calendar, not
    // just this patient's own tab — the Day view for its exact date,
    // not the default Month view: found live that the month view caps
    // how many entries a single day cell shows before collapsing the
    // rest into a "+N more" overflow (a real, intentional density limit,
    // not a bug), so a busy day can hide the very entry this assertion
    // is checking for. Day view has no such cap.
    await page.goto(`/appointments?view=day&date=${scheduledFor.slice(0, 10)}`);
    await expect(
      page.getByRole("button", { name: new RegExp(patientFullName) }),
    ).toBeVisible();
  });
});
