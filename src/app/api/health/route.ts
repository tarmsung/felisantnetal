import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Deliberately outside the (app) route group and excluded from proxy.ts's
// matcher (Phase 10): an orchestrator/load balancer's liveness probe has
// no session cookie and shouldn't be redirected to /login, and shouldn't
// pay for a session-refresh round trip on every check either.
export const runtime = "nodejs";

/**
 * A liveness check that's actually worth having means confirming the app
 * can reach Supabase, not just that the Node process is up — a container
 * can be "running" while its only real job (talking to the database) is
 * broken. Uses the ordinary anon-key server client (no admin/service-role
 * privilege needed): even though RLS means an unauthenticated request
 * sees zero rows from `clinic_settings`, RLS filters rows rather than
 * erroring, so a clean response here still proves the round trip to
 * Supabase's REST API succeeded. A thrown/network error means it didn't.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("clinic_settings").select("id").limit(1);
    if (error) throw new Error(error.message);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 503 },
    );
  }
}
