/**
 * One-time local bootstrap: creates the first administrator account so
 * there is a way to log in at all. Everything after that (more nurses,
 * more admins) is done through the in-app Users module (spec section 35),
 * once Phase 8 builds it — this script is not how the clinic manages
 * staff day to day.
 *
 * Usage:
 *   1. Fill in .env.local (see .env.example) with your Supabase project's
 *      URL and SERVICE ROLE key (Project Settings -> API in the Supabase
 *      dashboard). The service role key is required here because
 *      creating an auth user needs the Admin API.
 *   2. Set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME in
 *      .env.local (or pass them as environment variables inline).
 *   3. Run: npm run db:seed
 *
 * This script deliberately does NOT import lib/supabase/service.ts or
 * lib/services/userService.ts even though their logic overlaps with
 * what's below. Both of those carry an `import "server-only"` guard,
 * which resolves correctly only inside Next's own RSC bundler (it picks
 * the "react-server" export condition); run directly via tsx like this
 * script is, that condition is never set, so `server-only` always throws
 * "This module cannot be imported from a Client Component module" even
 * though nothing here is a Client Component. Rather than weaken that
 * guard for the real app, this script stays self-contained with its own
 * minimal copy of the service-client + user-creation logic.
 *
 * Uses relative imports rather than the project's "@/..." alias for the
 * same reason: tsx runs outside of Next's bundler, and relative paths
 * avoid depending on whether tsconfig path-alias resolution is picked up
 * for a bare script invocation.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// dotenv/config would only load ".env" — this project's convention
// (matching Next.js's own env-file precedence) is ".env.local".
loadEnv({ path: ".env.local" });
import type { Database } from "../src/types/database";

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before running this script.",
    );
    process.exit(1);
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME ?? "Clinic Administrator";

  if (!email || !password) {
    console.error(
      "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.local before running this script.",
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("SEED_ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    console.log(
      `A user with email ${email} already exists (role: ${existing.role}). Nothing to do.`,
    );
    return;
  }

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !created.user) {
    console.error(`Failed to create auth user: ${authError?.message ?? "unknown error"}`);
    process.exit(1);
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .insert({
      id: created.user.id,
      full_name: fullName,
      email,
      role: "administrator",
      status: "active",
    })
    .select("*")
    .single();

  if (profileError || !profile) {
    // Roll back the orphaned auth user so re-running the script isn't
    // blocked by a dangling email address with no profile.
    await supabase.auth.admin.deleteUser(created.user.id);
    console.error(`Failed to create user profile: ${profileError?.message ?? "unknown error"}`);
    process.exit(1);
  }

  console.log("Administrator account created:");
  console.log(`  Name:  ${profile.full_name}`);
  console.log(`  Email: ${profile.email}`);
  console.log(
    "Sign in at /login with the password you set in SEED_ADMIN_PASSWORD, then change it from the account's own settings.",
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
