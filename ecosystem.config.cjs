/**
 * PM2 process definitions for running this app without Docker (e.g. on
 * a bare host or a Windows machine) — PM2 restarts either process
 * automatically if it crashes. Requires a production build first:
 *
 *   npm run pm2:start     # first time — builds both, then starts both
 *   pm2 restart all       # after a code change — rebuild first (see
 *                         # pm2:restart), pm2 won't rebuild for you
 *   pm2 status            # check both are up
 *   pm2 logs              # tail both processes' output
 *   pm2 save              # persist this process list so `pm2 resurrect`
 *                         # can restore it after a reboot (does NOT by
 *                         # itself make PM2 start on boot — that needs
 *                         # `pm2-windows-startup` on Windows, or
 *                         # `pm2 startup` on Linux/macOS; ask before
 *                         # setting that up, it registers a system
 *                         # service)
 *
 * Reads .env.local directly (not committed — see .gitignore) so the
 * same secrets file the app already uses everywhere else is the one
 * source of truth here too, rather than duplicating values into this
 * file or the shell environment.
 */
require("dotenv").config({ path: ".env.local" });

module.exports = {
  apps: [
    {
      name: "felis-clinic",
      // next.config.ts sets output: "standalone" — this is the
      // production server it produces, NOT `next start` (which
      // actively refuses to run against a standalone build; see
      // ARCHITECTURE.md). scripts/prepare-standalone.mjs copies
      // public/ and .next/static/ in alongside it first.
      script: ".next/standalone/server.js",
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: process.env.PORT ?? "3000",
        HOSTNAME: "0.0.0.0",
      },
    },
    {
      name: "whatsapp-service",
      script: "dist/server.js",
      cwd: `${__dirname}/whatsapp-service`,
      env: {
        API_KEY: process.env.WHATSAPP_SERVICE_API_KEY,
        PORT: "3100",
      },
    },
  ],
};
