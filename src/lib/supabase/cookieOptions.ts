/**
 * Shared by all three places that construct a Supabase client
 * (server.ts, client.ts, proxy.ts) — one cookie, one options object.
 *
 * `secure` follows whether the app is actually served over HTTPS
 * (NEXT_PUBLIC_APP_URL starts with "https://"), not NODE_ENV. Phase 9
 * originally keyed it off NODE_ENV === "production", which silently
 * breaks login for any production deployment reachable only over plain
 * HTTP (e.g. a VPS addressed by bare IP before a domain exists): a
 * browser refuses to store a Secure cookie from a non-HTTPS origin, so
 * sign-in appears to succeed and then immediately bounces back to
 * /login. Plain HTTP is not something to run real patient data over
 * (see README "Deploying to a VPS") — this just makes the failure
 * mode honest instead of mysterious, and makes the cookie correct the
 * moment HTTPS is in place with no code change.
 *
 * NEXT_PUBLIC_* is inlined at build time, so this works identically in
 * client code (client.ts) and server code.
 *
 * `httpOnly` stays at @supabase/ssr's default (false) deliberately —
 * see ARCHITECTURE.md's Phase 9 section.
 */
export const supabaseCookieOptions = {
  secure: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
};
