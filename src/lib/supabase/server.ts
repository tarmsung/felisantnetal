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
      // @supabase/ssr's own default omits `secure` entirely (so the
      // cookie would ride along on a plain-HTTP request too) — set it
      // explicitly rather than relying on that default. Not forced on
      // for dev, since plain `next dev` serves over http://localhost.
      // `httpOnly` is deliberately left at its default (false): the
      // browser client (src/lib/supabase/client.ts) needs to read this
      // same cookie client-side for auth state, by Supabase's own
      // design — see ARCHITECTURE.md's Phase 9 section for the
      // accepted-risk reasoning (mitigated by proxy.ts's strict
      // production script-src CSP and this codebase having zero
      // dangerouslySetInnerHTML call sites).
      cookieOptions: { secure: process.env.NODE_ENV === "production" },
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
