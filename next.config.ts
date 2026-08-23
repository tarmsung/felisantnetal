import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone build (only the files a
  // deployed instance actually needs), which the Dockerfile copies —
  // keeps the production image small, important for the low-bandwidth
  // deployment context this project targets (spec section 31/37).
  output: "standalone",
  // @react-pdf/renderer's layout engine (@react-pdf/layout -> yoga-layout)
  // ships a WASM binary it loads directly via Node — bundling it through
  // Turbopack/webpack instead of letting Node `require` it natively is a
  // common source of "unreachable code" / WASM-instantiation failures in
  // Next.js apps that generate PDFs server-side (Phase 7). Keeping the
  // whole package external sidesteps that class of bug entirely.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Phase 9 security pass, part 1 of 2. These four are static — safe to
  // set once here. Content-Security-Policy is NOT here: Next.js injects
  // its own inline <script>/<style> tags for RSC hydration and HMR, so a
  // static script-src would either block the app outright or need
  // 'unsafe-inline' (defeating most of the point). It needs a fresh
  // nonce per request instead, generated in proxy.ts, where Next's docs
  // say to put it — see the comment there for the rest of this story.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
