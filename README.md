# Felis Clinic ANC Management System

A production-track web application for digitizing antenatal care (ANC)
patient registration, appointment scheduling, clinical visit records,
reminders, high-risk identification, reporting and patient-card PDF
generation at **Felis Clinic**, Marondera, Zimbabwe.

This project is being built in ten phases with a checkpoint after each
one. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the phase table, the
layer diagram, and — importantly — a list of places this implementation
deliberately deviates from a literal reading of the project brief, with
the reasoning for each.

## 1. Project overview

Felis Clinic currently runs ANC entirely on paper (handwritten patient
cards and register books), which makes appointment tracking, missed-visit
follow-up, high-risk identification, and monthly reporting slow and
error-prone. This app replaces that with a browser-based system that
works on desktops, tablets, and low-end Android phones.

**Explicitly out of scope** (brief section 42): billing/payments,
pharmacy management, inpatient/ward management, DHIS2 integration,
laboratory system integration.

## 2. Architecture

See [`ARCHITECTURE.md`](ARCHITECTURE.md). In short: Next.js App Router
on top of a hosted Supabase project (Postgres + Auth). Authorization is
enforced by Postgres Row Level Security, not just by the frontend —
see `supabase/migrations/20260101000009_rls_policies.sql`.

## 3. Technology stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind
  CSS v4, shadcn/ui (Base UI primitives), Lucide icons, react-hook-form + Zod.
- **Backend:** Next.js Server Actions / Route Handlers.
- **Database:** PostgreSQL via Supabase.
- **Auth:** Supabase Auth (email/password), profile/role data mirrored
  into `public.users`.
- **PDF:** `@react-pdf/renderer` (Phase 7).
- **Charts:** `recharts` (Phase 6).
- **Testing:** Vitest (unit) + Playwright (E2E).

## 4. Local installation

```bash
npm install
```

## 5. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Where to get it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API | Safe for the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page | Safe for the browser — RLS is the real gate |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page | **Server-only.** Never prefix with `NEXT_PUBLIC_`, never commit it |
| `DATABASE_URL` | Same page → Database | Only needed for direct SQL tooling |
| `WHATSAPP_SERVICE_URL`, `WHATSAPP_SERVICE_API_KEY` | You choose (see "WhatsApp integration" below) | Only read by the `baileys` provider; leave unset to stay on the `console` provider |
| `NEXT_PUBLIC_APP_URL` | — | e.g. `http://localhost:3000` |
| `CRON_SECRET` | Generate one (`openssl rand -hex 32`) | Protects the reminder cron endpoint (Phase 5) |
| `SEED_ADMIN_NAME/EMAIL/PASSWORD` | You choose | Only read by `scripts/seed.ts` |
| `E2E_ADMIN_EMAIL/PASSWORD`, `E2E_NURSE_EMAIL/PASSWORD` | Disposable staff accounts you create | Only read by `npm run test:e2e` (Phase 10) — never point these at a real clinic login |

Never commit `.env.local`; `.gitignore` already excludes it (and
explicitly keeps `.env.example` tracked).

## 6. Database setup

1. Create a Supabase project (supabase.com — free tier is enough for
   development).
2. Apply the migrations in `supabase/migrations/`, **in filename order**
   (they're numbered). Either:
   - Paste each file's contents into the Supabase dashboard's SQL
     Editor and run them in order, or
   - Install the Supabase CLI and run `supabase link` then
     `supabase db push` (this does **not** require Docker — Docker is
     only needed for `supabase start`'s local emulator, which this
     project doesn't use).
3. Fill in `.env.local` with that project's URL and keys (step 5 above).

### Migrations

All schema changes are files in `supabase/migrations/`, applied in
order. See `database/ERD.md` for what each one adds and why. There is no
"undo" migration set yet — this is a fresh schema with no prior state to
roll back to.

### Seed data

```bash
npm run db:seed
```

Creates exactly one thing: the first administrator account, from
`SEED_ADMIN_NAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in
`.env.local`. Every other account is created through the in-app Users
module once Phase 8 builds it. Sample patients/appointments/visits are
Phase 2+ concerns and, per spec section 29, must never ship into a
production database by default — when they're added, they'll be a
clearly separate `npm run db:seed:demo`-style script, not folded into
this one.

## 7. Running the development environment

```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`. Sign
in with the administrator account created by the seed script.

## 8. Running tests

```bash
npm run test        # unit tests (Vitest), one-shot
npm run test:watch  # unit tests, watch mode
npm run test:e2e     # Playwright E2E — requires .env.local pointed at a
                     # real Supabase project; it builds and starts the
                     # app itself (see playwright.config.ts)
```

**Unit tests** are pure logic — no network calls, no Supabase project
needed.

**E2E tests** (`e2e/*.spec.ts`, Phase 10) exercise real workflows —
patient registration, appointment scheduling, admin user management —
against a real, hosted Supabase project. There is no disposable test
database: every spec cleans up after itself (see `e2e/helpers.ts`), but
you still need:

- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (setup/teardown needs the
  Admin API — already required to run the app at all).
- `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` and
  `E2E_NURSE_EMAIL`/`E2E_NURSE_PASSWORD` — two **disposable** staff
  accounts, created via `/users` or `scripts/seed.ts`, distinct from any
  real clinic staff login. Tests that need a role skip themselves with a
  clear message if the relevant pair isn't set.
- At least one active community health worker on file (`/community-health-workers`)
  — patient registration requires picking one, and CHW rows can't be
  disposed of afterward (see the next paragraph), so the suite reuses
  whichever one your project already has rather than creating its own.

This schema never truly deletes a health or administrative record, by
design (see "Security considerations" below) — not even a service-role
connection can. So cleanup here means the same soft-delete/status
transitions the app itself uses (a patient's `deleted_at`, an
appointment's `cancelled` status, a staff account's `inactive` status),
not a real DELETE. A test-tagged row (`E2E-TEST-...`) can end up
permanently present-but-invisible in the schema; see `e2e/helpers.ts`'s
comments for exactly which tables that applies to and why. One
consequence worth knowing before you run this against a project you
care about the dashboard numbers of: risk-flag/clinical-visit workflows
aren't covered by this suite for exactly that reason — those records
feed the dashboard's live statistics with no filter for soft-deleted
patients, so a test-triggered risk flag would permanently skew real
reports, not just leave an inert row.

Playwright's own `webServer` config runs `npm run build && npm run
start` for you — you don't need a dev server running first (and if one
already is, it'll reuse it, which is slower for these tests than a
production build; stop it first for a truly clean run).

## 9. Production build

```bash
npm run build
npm run start
```

`next.config.ts` sets `output: "standalone"` so the build produces a
self-contained `.next/standalone` directory (used by the Dockerfile).

## 10. Deployment

**Docker:**

```bash
docker compose up --build
```

`docker-compose.yml` runs the app container and, since Phase 5, a
`whatsapp-service` container alongside it (a named volume,
`whatsapp-auth`, persists its paired WhatsApp session across restarts)
— the database is the hosted Supabase project, not a local container
for either service. `Dockerfile` is a multi-stage build; `NEXT_PUBLIC_*`
values are passed as build args (see the compose file), while
server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_SERVICE_API_KEY`,
etc.) are supplied at runtime via `.env.local` / your platform's secret
store — never baked into the image. See `whatsapp-service/README.md`
before pairing a real clinic phone number to it.

**Without Docker:** any Node 22+ host works — `npm run build && npm run
start`, with the same environment variables set (`next start` runs, with
a harmless warning that it's not using the standalone output).

**Without Docker, staying up on its own (PM2):** `ecosystem.config.cjs`
runs the actual standalone build (not `next start`) for the app plus
`whatsapp-service`, both under [PM2](https://pm2.keymetrics.io/), which
restarts either one automatically if it crashes — confirmed live by
killing the app's process directly and watching PM2 bring it back
within seconds, session/pairing state intact.

```bash
npm install -g pm2   # once
npm run pm2:start    # builds both, then starts both under PM2
pm2 status           # confirm both are "online"
pm2 logs             # tail both processes' output
pm2 save             # persist this process list for `pm2 resurrect`
```

After a code change, PM2 won't rebuild for you — use `npm run
pm2:restart` (rebuilds both, then restarts both), not a bare `pm2
restart`. `pm2 save` persists the process *list*, not a boot-time
launcher — surviving an actual machine reboot needs a Windows service
registered via a tool like `pm2-windows-startup`, which this repo
doesn't set up automatically since installing a system service is a
bigger, harder-to-reverse step than restarting a crashed process.

**Health check:** `GET /api/health` (Phase 10) actually queries
Supabase rather than just confirming the Node process is up — see
`src/app/api/health/route.ts`. The Dockerfile's own `HEALTHCHECK`
already points at it; wire the same URL into whatever load
balancer/orchestrator you deploy behind. It's excluded from
`proxy.ts`'s auth redirect (a liveness probe has no session cookie) and
returns `503` rather than a redirect if Supabase is unreachable.

## 11. Continuous integration

`.github/workflows/ci.yml` (Phase 10) runs lint, typecheck, unit tests,
and a production build on every push/PR — everything that doesn't need
a real Supabase project. It deliberately does **not** run the
Playwright E2E suite: those tests touch this clinic's real hosted
project (see "Running tests" above), which isn't something to do from
an unattended workflow on every push. Run `npm run test:e2e` locally,
against a project you're comfortable seeding and cleaning up against,
before a release.

## 12. WhatsApp integration

Built in Phase 5 — see [`ARCHITECTURE.md`](ARCHITECTURE.md#phase-5-whatsapp-reminders)
for the full design and, importantly, a ban-risk disclosure worth
reading before enabling it for real. Short version:

- **Read `whatsapp-service/README.md` before pairing a real clinic
  phone number.** It uses an unofficial WhatsApp client
  ([Baileys](https://github.com/WhiskeySockets/Baileys)), not the
  sanctioned WhatsApp Business API — there is a real, inherent risk of
  the connected number being banned, with no official appeal path.
- The default provider is `console` (logs instead of sending) — nothing
  is sent until an administrator switches Settings → Notifications →
  WhatsApp provider to "WhatsApp (Baileys)".
- Switching it on starts a separate process, `whatsapp-service/` (its
  own README covers running it standalone or via this repo's
  `docker-compose.yml`), and requires `WHATSAPP_SERVICE_URL` /
  `WHATSAPP_SERVICE_API_KEY` set in `.env.local` (see the environment
  variables table above).
- Pairing is a one-time QR-code scan from the Settings page, once the
  service is running and reachable — the page shows a live connection
  status and the QR itself while unpaired.
- The reminder sweep runs at `POST /api/cron/reminders`, guarded by
  `CRON_SECRET` — this app has no built-in scheduler, so it needs an
  external trigger (system cron, your hosting platform's scheduled
  jobs, etc.) hitting that endpoint on a schedule. A nurse/administrator
  can also send an individual reminder immediately from an
  appointment's detail view ("Send reminder now").
- `NotificationProvider` (`lib/services/notifications/`) is a swappable
  interface, not tied to WhatsApp specifically — adding SMS/email or
  swapping to the official Business API later is a new provider file
  plus one Settings change, not an application-wide rewrite.

## 13. Backup recommendations

This app does not implement its own backup mechanism — deliberately: a
hosted Supabase project already takes automatic Postgres backups
(frequency depends on your Supabase plan), which is a stronger
guarantee than an application-level export script could give on its
own. Recommendations for whoever operates this in production:

- Confirm your Supabase plan's backup frequency and retention meet the
  clinic's actual recovery-point requirements; upgrade the plan if not.
- Periodically test a restore into a scratch project — a backup that's
  never been restored is unverified.
- Treat `supabase/migrations/` as the source of truth for schema, so a
  disaster-recovery restore ends up on a schema you recognize, and any
  future schema change is always a new migration file, never a manual
  edit against the live database.
- Do not rely on any future PDF/report export feature as a backup
  substitute — it's a user-facing document, not a data backup.

## 14. Security considerations

- Authorization is enforced in Postgres via Row Level Security, not
  only in the frontend — see `supabase/migrations/*_rls_policies.sql`
  and `ARCHITECTURE.md`.
- No password or credential is ever stored in this application's own
  schema; Supabase Auth owns that.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-only. It's used in
  exactly two places (`lib/supabase/service.ts`'s callers): the
  WhatsApp reminder cron (Phase 5) and staff account creation
  (`lib/services/userService.ts`) — both unreachable from a browser.
- Historical health records (`clinical_visits`, `risk_flags`,
  `audit_logs`, and more) cannot be hard-deleted by anyone, including
  an administrator or a service-role connection — enforced by database
  triggers, not just missing UI.
- This system is **not** described as compliant with any specific
  regulatory framework (e.g. HIPAA) — no such compliance review has
  been performed. Deploying this for a real clinic in Zimbabwe should
  include a review against applicable Zimbabwean data-protection and
  health-information requirements, done by someone qualified to assess
  that, before go-live.
- The application assists with organization and record-keeping; it is
  not a diagnostic system. Any clinically abnormal reading surfaces as
  "Clinical review required," never as an automated diagnosis (spec
  section 48).
