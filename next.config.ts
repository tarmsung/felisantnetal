import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone build (only the files a
  // deployed instance actually needs), which the Dockerfile copies —
  // keeps the production image small, important for the low-bandwidth
  // deployment context this project targets (spec section 31/37).
  output: "standalone",
};

export default nextConfig;
