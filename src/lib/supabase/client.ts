"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client. Uses the anon key only — every read/write
 * made through this client is still subject to the RLS policies in
 * /supabase/migrations/20260101000009_rls_policies.sql. It exists mainly
 * for auth state (sign-in/out) and any client components that need
 * realtime subscriptions later; ordinary data fetching should prefer the
 * server client so pages can be rendered on the server.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Matches src/lib/supabase/server.ts and proxy.ts — same cookie,
      // three write sites, one options object between them.
      cookieOptions: { secure: process.env.NODE_ENV === "production" },
    },
  );
}
