import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseCookieOptions } from "@/lib/supabase/cookieOptions";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

// The browser's only legitimate cross-origin destination is this
// deployment's own Supabase project (auth + data fetches from client
// components). Read from the same public env var the Supabase client
// already uses rather than hardcoding a host, so this doesn't silently
// break — or silently stay wide open — on a different deployment.
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();

/**
 * Content-Security-Policy needs a fresh nonce per request because Next
 * injects its own inline `<script>`/`<style>` tags for RSC hydration —
 * a static script-src without one either blocks the app outright or
 * needs 'unsafe-inline', which defeats most of the point of having a CSP
 * at all. This is the nonce pattern from Next.js's own CSP docs: put the
 * nonce in the outgoing header, and Next automatically stamps it onto
 * the inline tags it manages when it sees a nonce source in the
 * response's own CSP header.
 *
 * Production-only, confirmed live rather than assumed: under `next dev`
 * + Turbopack, React dev mode needs `eval()` for its stack-reconstruction
 * tooling and Fast Refresh injects its own inline styles that aren't
 * covered by Next's auto-nonce, so a strict CSP breaks the dev server
 * outright (dashboard hydration failed, charts never painted).
 *
 * style-src keeps 'unsafe-inline' even in production, found necessary by
 * running a real `next build && next start` and reading the console: any
 * component using React's `style={{...}}` prop (this codebase's
 * ChartContainer, and Base UI's own portal-positioning internals) has it
 * serialized into the initial SSR'd HTML as a literal `style="..."`
 * attribute, which only gets the CSP-exempt treatment (individual CSSOM
 * property assignment) on client-side re-renders, not on the server-sent
 * markup — Next's auto-nonce only covers its own script/style tags, not
 * arbitrary components' inline style attributes. script-src still gets
 * the full nonce + strict-dynamic treatment; that's the directive that
 * actually stops injected-script XSS, which is the point of this header.
 */
function buildCsp(nonce: string): string {
  if (process.env.NODE_ENV !== "production") {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' ws: wss:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    ].join("; ");
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Runs on every request (Next.js 16 renamed this file convention from
 * "middleware" to "proxy" — same mechanism, new name; see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * Three jobs:
 *   1. Refresh the Supabase session cookie (required by @supabase/ssr —
 *      without this, sessions silently expire mid-use).
 *   2. Redirect signed-out users away from anything but the public paths,
 *      and signed-in users away from /login.
 *   3. Stamp a per-request CSP nonce (Phase 9 security pass) onto both
 *      the request (so a Server Component could read it via headers() if
 *      it ever needs to nonce something itself) and the response.
 *
 * The auth redirect is a UX convenience, NOT the authorization boundary —
 * that's RLS (supabase/migrations/20260101000009_rls_policies.sql). Even
 * if this redirect were buggy or bypassed, the database itself refuses
 * unauthorized reads/writes.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Same cookieOptions as src/lib/supabase/server.ts and client.ts —
      // see cookieOptions.ts.
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set("Content-Security-Policy", csp);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!data.user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(loginUrl);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  if (data.user && request.nextUrl.pathname === "/login") {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // api/health (Phase 10): an orchestrator's liveness probe has no
    // session cookie and shouldn't be redirected to /login, or pay for
    // a session-refresh round trip on every check.
    // api/cron/reminders (Phase 5): an external scheduler trigger has
    // no session cookie either — it authenticates itself with
    // CRON_SECRET (see that route's own comment), not a staff login.
    "/((?!_next/static|_next/image|favicon.ico|brand/|api/health|api/cron/|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
