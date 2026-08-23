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
};

export default nextConfig;
