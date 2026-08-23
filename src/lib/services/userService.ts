import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logAuditEvent, diffForAudit } from "@/lib/services/auditService";
import type { UserRole, UserStatus, UserRow } from "@/types/database";

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

export async function listUsers(): Promise<UserRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("users").select("*").order("full_name");
  if (error) throw new Error(`Failed to load users: ${error.message}`);
  return data ?? [];
}

/** Active administrators, optionally excluding one user — used by the "don't lock the clinic out" guards below. */
async function countActiveAdmins(excludingUserId?: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  let builder = supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "administrator")
    .eq("status", "active");
  if (excludingUserId) builder = builder.neq("id", excludingUserId);

  const { count, error } = await builder;
  if (error) throw new Error(`Failed to check administrator count: ${error.message}`);
  return count ?? 0;
}

/**
 * Changes a staff member's role. Refuses two things no clinic wants to
 * discover by accident: an administrator demoting themselves (they'd
 * lose access to undo it), and demoting the clinic's last active
 * administrator (nobody left who can manage staff at all).
 */
export async function updateUserRole(
  userId: string,
  role: UserRole,
  actingUserId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: before, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
  if (fetchError || !before) throw new Error(`User not found: ${fetchError?.message ?? "unknown error"}`);

  if (before.role === "administrator" && role !== "administrator") {
    if (userId === actingUserId) {
      throw new Error("You cannot remove your own administrator role.");
    }
    if (before.status === "active" && (await countActiveAdmins(userId)) === 0) {
      throw new Error("At least one active administrator must remain — promote another user first.");
    }
  }

  const { error } = await supabase.from("users").update({ role }).eq("id", userId);
  if (error) throw new Error(`Failed to update role: ${error.message}`);

  const diff = diffForAudit(before, { ...before, role });
  if (diff) {
    await logAuditEvent({ userId: actingUserId, action: "user.update_role", entityType: "user", entityId: userId, ...diff });
  }
}

/** Same two safety rails as updateUserRole, applied to deactivation instead of demotion. */
export async function updateUserStatus(
  userId: string,
  status: UserStatus,
  actingUserId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: before, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
  if (fetchError || !before) throw new Error(`User not found: ${fetchError?.message ?? "unknown error"}`);

  if (status === "inactive") {
    if (userId === actingUserId) {
      throw new Error("You cannot deactivate your own account.");
    }
    if (before.role === "administrator" && before.status === "active" && (await countActiveAdmins(userId)) === 0) {
      throw new Error("At least one active administrator must remain — activate another admin first.");
    }
  }

  const { error } = await supabase.from("users").update({ status }).eq("id", userId);
  if (error) throw new Error(`Failed to update status: ${error.message}`);

  const diff = diffForAudit(before, { ...before, status });
  if (diff) {
    await logAuditEvent({ userId: actingUserId, action: "user.update_status", entityType: "user", entityId: userId, ...diff });
  }
}

/**
 * Admin-driven password reset — there's no self-service "forgot
 * password" email flow yet (that needs an email provider this project
 * doesn't have; WhatsApp, Phase 5, isn't a substitute for it). An
 * administrator sets a new temporary password directly and communicates
 * it to the staff member out of band, same as account creation.
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string,
  actingUserId: string,
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw new Error(`Failed to reset password: ${error.message}`);

  await logAuditEvent({
    userId: actingUserId,
    action: "user.reset_password",
    entityType: "user",
    entityId: userId,
  });
}
