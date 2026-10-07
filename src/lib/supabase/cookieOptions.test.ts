import { afterEach, describe, expect, it, vi } from "vitest";

// The value is computed at import time (NEXT_PUBLIC_* is inlined at
// build time), so each case re-imports the module under a stubbed env.
async function loadWith(appUrl: string | undefined) {
  vi.resetModules();
  if (appUrl === undefined) vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  else vi.stubEnv("NEXT_PUBLIC_APP_URL", appUrl);
  return (await import("./cookieOptions")).supabaseCookieOptions;
}

describe("supabaseCookieOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("marks the cookie Secure when the app is served over https", async () => {
    expect((await loadWith("https://felis.duckdns.org")).secure).toBe(true);
  });

  it("does NOT mark it Secure over plain http — a browser would drop it and login would bounce back to /login", async () => {
    expect((await loadWith("http://203.0.113.10")).secure).toBe(false);
    expect((await loadWith("http://localhost:3000")).secure).toBe(false);
  });

  it("defaults to not Secure when the URL isn't configured", async () => {
    expect((await loadWith(undefined)).secure).toBe(false);
  });
});
