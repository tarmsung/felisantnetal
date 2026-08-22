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
| `WHATSAPP_PROVIDER`, `WHATSAPP_API_URL`, `WHATSAPP_API_KEY` | Your WhatsApp provider | Not used until Phase 5 |
| `NEXT_PUBLIC_APP_URL` | — | e.g. `http://localhost:3000` |
| `CRON_SECRET` | Generate one (`openssl rand -hex 32`) | Protects the reminder cron endpoint, added in Phase 5 |
| `SEED_ADMIN_NAME/EMAIL/PASSWORD` | You choose | Only read by `scripts/seed.ts` |

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

`docker-compose.yml` runs only the app container — the database is the
hosted Supabase project, not a local container. `Dockerfile` is a
multi-stage build; `NEXT_PUBLIC_*` values are passed as build args (see
the compose file), while server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`,
etc.) are supplied at runtime via `.env.local` / your platform's secret
store — never baked into the image.

**Without Docker:** any Node 22+ host works — `npm run build && npm run
start`, with the same environment variables set.

## 11. WhatsApp integration

Not implemented yet (Phase 5). The architecture is decided in
[`ARCHITECTURE.md`](ARCHITECTURE.md#notifications-whatsapp-and-later-smsemail):
a `NotificationService` facade over a swappable provider interface,
selected by `WHATSAPP_PROVIDER`, so switching WhatsApp providers (or
adding SMS/email) later doesn't require an application-wide rewrite.

## 12. Backup recommendations

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

## 13. Security considerations

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
