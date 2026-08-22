import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { UserRole, UserRow } from "@/types/database";

export interface CreateStaffUserInput {
  fullName: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  temporaryPassword: string;
}

/**
 * Creates both the auth.users credential row (via the Admin API, which
 * requires the service role) and the matching public.users profile row.
 *
 * SECURITY: this function does not check who is calling it — that is the
 * caller's job. Every code path that reaches this (the admin "create
 * user" server action in Phase 8, and scripts/seed.ts) MUST verify the
 * acting context is authorized (requireAdmin(), or "this is a one-time
 * local bootstrap script") before calling it. Never expose this directly
 * to a client-callable endpoint without that check.
 */
export async function createStaffUser(input: CreateStaffUserInput): Promise<UserRow> {
  const supabase = createSupabaseServiceClient();

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.temporaryPassword,
    email_confirm: true,
  });

  if (authError || !created.user) {
    throw new Error(`Failed to create auth user: ${authError?.message ?? "unknown error"}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .insert({
      id: created.user.id,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone ?? null,
      role: input.role,
      status: "active",
    })
    .select("*")
    .single();

  if (profileError || !profile) {
    // Roll back the orphaned auth user so retrying isn't blocked by a
    // dangling email address with no profile.
    await supabase.auth.admin.deleteUser(created.user.id);
    throw new Error(`Failed to create user profile: ${profileError?.message ?? "unknown error"}`);
  }

  return profile;
}
