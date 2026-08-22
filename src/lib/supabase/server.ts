import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client scoped to the signed-in user's session
 * (via their auth cookies). Every Server Component, Server Action and
 * Route Handler should read/write through this client so that RLS
 * (migration 0009) is the real authorization boundary — not just the
 * route guard in proxy.ts.
 *
 * Must be created fresh per request (cookies() is request-scoped).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render (not an Action/Route
            // Handler) where cookies can't be mutated — safe to ignore
            // because proxy.ts refreshes the session on every request.
          }
        },
      },
    },
  );
}
