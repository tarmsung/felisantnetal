/**
 * `output: "standalone"` (next.config.ts) produces .next/standalone with
 * server.js and its own node_modules, but deliberately excludes
 * public/ and .next/static/ — Next's own docs say to copy those in
 * yourself. The Dockerfile already does this via explicit COPY steps;
 * this script does the same thing for running the standalone build
 * directly on a host (e.g. under PM2, see ecosystem.config.cjs)
 * without Docker.
 *
 * Usage: npm run build && node scripts/prepare-standalone.mjs
 */
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const standaloneDir = path.join(root, ".next", "standalone");

if (!existsSync(standaloneDir)) {
  console.error("No .next/standalone found — run `npm run build` first.");
  process.exit(1);
}

cpSync(path.join(root, "public"), path.join(standaloneDir, "public"), { recursive: true });
cpSync(
  path.join(root, ".next", "static"),
  path.join(standaloneDir, ".next", "static"),
  { recursive: true },
);

console.log("Copied public/ and .next/static/ into .next/standalone/.");
