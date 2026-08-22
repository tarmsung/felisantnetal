import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely.
 *
 * ONLY use this for:
 *   - the WhatsApp reminder cron job (lib/services/notificationService.ts),
 *     which must scan appointments/patients across all staff, not just
 *     the current user's session;
 *   - creating a staff auth account (Supabase Admin API), which requires
 *     the service role by design.
 *
 * Never import this from a Client Component, never expose the key to the
 * browser, and never use it as a shortcut around a permission check —
 * check the acting user's role yourself (see lib/auth/session.ts) before
 * calling anything that uses this client.
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL are not configured.",
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
