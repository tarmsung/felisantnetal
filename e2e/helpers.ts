/**
 * Shared helpers for the Playwright E2E suite.
 *
 * These tests run against a real, hosted Supabase project — the same
 * one the developer live-tests against day to day, not a disposable
 * test database (see README.md "Running tests" / playwright.config.ts).
 * Every helper here exists to make that safe:
 *
 *  - `createSupabaseAdminClient()` gives tests a service-role client for
 *    setup/teardown, so a test can create/inspect/clean up rows without
 *    depending on whichever UI flow it's actually trying to exercise.
 *  - `login()` authenticates through the real /login form using
 *    credentials for a *disposable* staff account, read from env vars
 *    rather than hardcoded — see its own comment below.
 *  - The rest are small data helpers (unique test-tagged names, and
 *    cleanup routines that respect this schema's "never hard-delete a
 *    health/administrative record" rule — see the big comment on
 *    `softDeleteTestPatient` below before adding a new cleanup helper
 *    that assumes a plain DELETE will work).
 *
 * Deliberately self-contained, like scripts/seed.ts: it does NOT import
 * from src/lib/supabase/service.ts (or any other src/lib module that
 * carries `import "server-only"`), because that guard only resolves
 * correctly inside Next's own RSC bundler. Playwright runs this file
 * directly under Node, the same situation scripts/seed.ts is in, so it
 * gets its own minimal copy of the service-client construction instead.
 * For the same reason, this file uses relative imports rather than the
 * project's "@/..." alias for its one type-only import.
 */
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, type Page } from "@playwright/test";
import type { Database } from "../src/types/database";

// Playwright's own test runner does not read .env.local the way Next.js
// does — load it explicitly so this file (and any spec that imports it)
// can see NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / the
// E2E_* login vars regardless of how `npx playwright test` was invoked.
loadEnv({ path: ".env.local" });

export function createSupabaseAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local " +
        "to run E2E tests that set up or clean up their own data.",
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type StaffRole = "administrator" | "nurse";

interface LoginCredentials {
  email: string;
  password: string;
}

function envCredentialsFor(role: StaffRole): { credentials: LoginCredentials | null; varPrefix: string } {
  const varPrefix = role === "administrator" ? "E2E_ADMIN" : "E2E_NURSE";
  const email = process.env[`${varPrefix}_EMAIL`];
  const password = process.env[`${varPrefix}_PASSWORD`];
  return { credentials: email && password ? { email, password } : null, varPrefix };
}

/**
 * Logs in through the real /login form (not a storageState shortcut —
 * this suite is small enough that exercising the actual form is more
 * valuable than the speed a saved session would buy) and waits for the
 * post-login redirect to /dashboard.
 *
 * Requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD (role: "administrator")
 * or E2E_NURSE_EMAIL/E2E_NURSE_PASSWORD (role: "nurse") in .env.local.
 * These MUST point at real but disposable staff accounts created
 * specifically for E2E testing — via the app's own Users module
 * (Phase 8, see e2e/admin-users.spec.ts) or scripts/seed.ts — and must
 * be distinct from any account a real clinic staff member actually
 * signs in with. Never point these at a production login.
 *
 * If the relevant env vars aren't set, this calls test.skip() with a
 * clear message rather than failing, so a contributor who hasn't
 * provisioned E2E credentials yet just sees a skipped test.
 */
export async function login(page: Page, role: StaffRole): Promise<void> {
  const { credentials, varPrefix } = envCredentialsFor(role);
  if (!credentials) {
    test.skip(
      true,
      `Set ${varPrefix}_EMAIL and ${varPrefix}_PASSWORD in .env.local (a disposable staff ` +
        `account, not a real clinic login) to run this test.`,
    );
    return;
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

/**
 * A name/tag that's both unique (won't collide with real clinic data or
 * a previous, possibly-failed test run) and obviously test data if
 * anyone ever looks at the table directly.
 */
export function e2eTag(label: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `E2E-TEST-${label}-${unique}`;
}

/** YYYY-MM-DD, `daysFromNow` in the future — for date-only fields like EDD/DOB. */
export function futureDateOnly(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/** `YYYY-MM-DDTHH:mm` in local wall-clock time, for <input type="datetime-local">. */
export function futureLocalDateTime(hoursFromNow: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * An already-active community health worker to register a test patient
 * against. Every patient registration requires picking one (see
 * lib/validation/patientSchemas.ts), but community_health_workers rows
 * can never be hard-deleted (migration 0007's prevent_delete trigger
 * fires even for a service-role connection) — so tests reuse whichever
 * CHW the project already has rather than creating a permanent one of
 * their own. Callers should `test.skip()` when this returns null.
 */
export async function getAnyActiveCommunityHealthWorkerId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("community_health_workers")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to look up a community health worker: ${error.message}`);
  return data?.id ?? null;
}

export interface CreateTestPatientOptions {
  fullName: string;
  communityHealthWorkerId: string;
  edd: string;
  nationalId?: string;
  phone?: string;
  dateOfBirth?: string;
}

/**
 * Creates a patient + its first pregnancy episode directly via the
 * same `register_patient()` Postgres function the real registration
 * form calls (migration 0011) — one round trip, one transaction, same
 * invariants as the app itself, rather than two separate inserts that
 * could plausibly drift from what the app guarantees. Used by specs
 * that need a patient to already exist so they can focus on a
 * *different* workflow (e.g. appointment-scheduling.spec.ts) without
 * re-testing registration in the process.
 */
export async function createTestPatientWithPregnancy(
  supabase: SupabaseClient<Database>,
  opts: CreateTestPatientOptions,
): Promise<{ patientId: string }> {
  const { data, error } = await supabase.rpc("register_patient", {
    p_full_name: opts.fullName,
    p_national_id: opts.nationalId ?? null,
    p_date_of_birth: opts.dateOfBirth ?? null,
    p_phone: opts.phone ?? null,
    p_alternative_phone: null,
    p_address: null,
    p_emergency_contact_name: null,
    p_emergency_contact_phone: null,
    p_community_health_worker_id: opts.communityHealthWorkerId,
    p_notes: "Created by the Playwright E2E suite — safe to ignore.",
    p_gravida: null,
    p_para: null,
    p_lmp: null,
    p_edd: opts.edd,
    p_gestational_information: null,
  });

  if (error || !data) {
    throw new Error(`Failed to create test patient: ${error?.message ?? "unknown error"}`);
  }
  return { patientId: data };
}

/**
 * Cleanup for anything under `patients`/`pregnancies`/`appointments`
 * created by this suite.
 *
 * IMPORTANT — this is a soft delete, not a real one, and that's
 * intentional, not a shortcut: migration 0007
 * (`supabase/migrations/20260101000007_functions_and_triggers.sql`)
 * installs a `before delete` trigger on patients, pregnancies and
 * appointments (among others) that unconditionally raises an
 * exception — "Deletion is not permitted on % — use a status or
 * soft-delete field instead." This fires even for a service-role
 * connection, which is otherwise the one client that bypasses Row
 * Level Security; there is no privilege level that can hard-delete
 * these rows through this schema, by design (see README.md "Security
 * considerations").
 *
 * So "clean up after the test" here means the closest equivalent the
 * schema allows:
 *  - patients: set `deleted_at`, the app's own soft-delete field. Every
 *    read in the app filters `is("deleted_at", null)`, so this makes
 *    the row permanently invisible everywhere the UI looks, even though
 *    it's still physically present (still `E2E-TEST-`-tagged if anyone
 *    inspects the table directly).
 *  - pregnancies: no soft-delete column exists at all, and rows are
 *    only ever removed via `on delete cascade` from their patient —
 *    which itself can never fire, since deleting the patient is
 *    blocked. The pregnancy row this test created is therefore left in
 *    place permanently, orphaned under a soft-deleted patient. This is
 *    an accepted, unavoidable residue of the schema's own design, not
 *    a bug in this helper.
 *  - appointments: no soft-delete column either, but `status` already
 *    has a legitimate terminal state for "this appointment isn't
 *    happening" — `cancelled` (the same state the app's own cancel
 *    workflow, appointmentService.cancelAppointment, uses). Tests
 *    cancel rather than delete for exactly that reason.
 */
export async function softDeleteTestPatient(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("patients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", patientId);

  if (error) {
    throw new Error(`Failed to soft-delete test patient ${patientId}: ${error.message}`);
  }
}

/** See softDeleteTestPatient's comment — appointments can't be hard-deleted, only cancelled. */
export async function cancelAllAppointmentsForPatient(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled", cancellation_reason: "E2E test cleanup" })
    .eq("patient_id", patientId)
    .neq("status", "cancelled");

  if (error) {
    throw new Error(`Failed to cancel test appointments for patient ${patientId}: ${error.message}`);
  }
}

/**
 * Best-effort hard delete of a staff auth user, for admin-users.spec.ts
 * cleanup. In practice this will fail once the account has a linked
 * public.users row, and that failure is expected — see this project's
 * own lib/services/userService.ts `createStaffUser`, which only ever
 * calls `auth.admin.deleteUser` to roll back an *orphaned* auth user
 * (one whose public.users insert failed), never a fully-created one.
 * The reason is the same trigger described on softDeleteTestPatient:
 * public.users.id is `references auth.users (id) on delete cascade`
 * (migration 0002), so deleting the auth user tries to cascade-delete
 * its public.users row, which migration 0007's unconditional
 * `prevent_delete` trigger blocks — even for a service-role connection.
 * There is no way to fully delete a staff account that has ever had a
 * profile row, by this schema's design.
 *
 * This still attempts the real delete (in case a project's trigger
 * setup ever changes) and reports whether it succeeded, but callers
 * MUST NOT treat a `false` return as a failed test run — the durable
 * cleanup step is deactivating the account (`status: "inactive"`),
 * which the caller should always do regardless of this helper's result.
 */
export async function tryHardDeleteAuthUser(
  supabase: SupabaseClient<Database>,
  authUserId: string,
): Promise<boolean> {
  const { error } = await supabase.auth.admin.deleteUser(authUserId);
  return !error;
}

/** Deactivates (never truly deletes — see tryHardDeleteAuthUser) a staff account by id. */
export async function deactivateTestUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("users").update({ status: "inactive" }).eq("id", userId);
  if (error) {
    throw new Error(`Failed to deactivate test user ${userId}: ${error.message}`);
  }
}
