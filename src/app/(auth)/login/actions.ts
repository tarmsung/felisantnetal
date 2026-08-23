"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/services/auditService";
import { loginSchema } from "@/lib/validation/authSchemas";

export interface LoginActionState {
  error?: string;
}

/**
 * `next` round-trips through the URL (proxy.ts sets it from the path a
 * signed-out visit was redirected from) and this form's hidden field, so
 * it's attacker-controlled: a crafted /login?next=//evil.com link passes
 * a bare `startsWith("/") && !startsWith("//")` check on some browsers'
 * URL parsers anyway, since backslash is normalized to forward-slash for
 * http(s) URLs — `/\evil.com` or `\\evil.com` still resolve as
 * protocol-relative, turning a normal login into an open redirect used
 * for phishing (Phase 9 security pass finding). An allowlist of the
 * characters this app's real routes ever use is simpler to reason about
 * than trying to enumerate every parser quirk a denylist would need to
 * cover; none of this app's routes carry a query string in `next` (see
 * proxy.ts — only ever a bare pathname), so none is allowed here either.
 */
const SAFE_NEXT_PATH = /^\/[A-Za-z0-9\-_/]*$/;

function resolveSafeNextPath(value: FormDataEntryValue | null): string {
  return typeof value === "string" && SAFE_NEXT_PATH.test(value) ? value : "/dashboard";
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

  redirect(resolveSafeNextPath(formData.get("next")));
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
