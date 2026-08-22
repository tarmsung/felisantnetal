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
 * This script uses relative imports rather than the project's "@/..."
 * alias — tsx runs it outside of Next's bundler, and relative paths
 * avoid depending on whether tsconfig path-alias resolution is picked up
 * for a bare script invocation.
 */
import "dotenv/config";
import { createStaffUser } from "../src/lib/services/userService";
import { createSupabaseServiceClient } from "../src/lib/supabase/service";

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

  const supabase = createSupabaseServiceClient();
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

  const user = await createStaffUser({
    fullName,
    email,
    role: "administrator",
    temporaryPassword: password,
  });

  console.log("Administrator account created:");
  console.log(`  Name:  ${user.full_name}`);
  console.log(`  Email: ${user.email}`);
  console.log(
    "Sign in at /login with the password you set in SEED_ADMIN_PASSWORD, then change it from the account's own settings.",
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
