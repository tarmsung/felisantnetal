import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRow } from "@/types/database";

export interface AuthenticatedUser extends UserRow {
  authUserId: string;
}

/**
 * Reads the signed-in user's profile (public.users), not just their auth
 * session. Returns null if there is no session OR if the profile row is
 * missing/inactive — callers should treat both the same way (no access).
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (error || !profile) return null;

  return { ...profile, authUserId: authData.user.id };
}

/**
 * Use at the top of a protected Server Component / Server Action /
 * Route Handler. Redirects to /login rather than throwing, since the
 * common case (expired session) is a normal navigation, not a bug.
 * This is a convenience layer on top of RLS, not a substitute for it —
 * every query still runs through the RLS policies regardless.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") {
    redirect("/login");
  }
  return user;
}

/** Same as requireUser, but also enforces the administrator role. */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (user.role !== "administrator") {
    redirect("/dashboard");
  }
  return user;
}
