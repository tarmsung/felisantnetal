"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/services/auditService";
import { loginSchema } from "@/lib/validation/authSchemas";

export interface LoginActionState {
  error?: string;
}

/**
 * Server Action backing the login form. Never trusts the client for
 * anything beyond email/password — role/status are re-read from the
 * database after Supabase Auth confirms the credentials.
 */
export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return { error: "Incorrect email or password." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return {
      error:
        "This account is not active. Contact a clinic administrator for access.",
    };
  }

  await supabase
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", profile.id);

  await logAuditEvent({
    userId: profile.id,
    action: "auth.login",
    entityType: "user",
    entityId: profile.id,
  });

  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    await logAuditEvent({
      userId: data.user.id,
      action: "auth.logout",
      entityType: "user",
      entityId: data.user.id,
    });
  }

  await supabase.auth.signOut();
  redirect("/login");
}
