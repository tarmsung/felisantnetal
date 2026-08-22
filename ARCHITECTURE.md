# Architecture

Felis Clinic ANC Management System — a Next.js + Supabase application for
digitizing antenatal care at Felis Clinic, Marondera, Zimbabwe.

This document is the "why", not the "what" — it explains the decisions
behind the schema and layout so the next phase (or the next person)
doesn't have to re-derive them from the code. For the field-by-field
schema, see [`database/ERD.md`](database/ERD.md) and the migrations in
[`supabase/migrations/`](supabase/migrations).

## Build status

This project is being built in the ten phases defined by the project
brief. Each phase is a checkpoint with the project owner before the next
one starts.

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup: schema, architecture, design system, auth skeleton | **Done** (this checkpoint) |
| 2 | Patient management: registration, search, profile | Not started |
| 3 | ANC scheduling: engine, calendar, rescheduling, missed visits | Not started |
| 4 | Clinical records: visit recording, validation, risk flag engine | Not started |
| 5 | WhatsApp reminders: notification service, scheduler, delivery logs | Not started |
| 6 | Dashboard and reports: metrics, charts, filters | Not started |
| 7 | PDF generation: patient card, report exports | Not started |
| 8 | Administration: users, settings, clinical rule config, audit log viewer | Not started |
| 9 | Security & optimization pass | Not started |
| 10 | Testing & deployment | Ongoing in every phase; hardened at the end |

The sidebar/navigation (`src/lib/navigation.ts`) already lists every
module from the final IA, each tagged with the phase that implements it.
Until then, its page renders a `ComingSoon` placeholder rather than a
404, so the whole app is navigable today even though most of it isn't
built yet.

## Layers

```text
UI (Server & Client Components, src/app, src/components)
 |
 v
Server Actions / Route Handlers  (the only place a mutation is allowed to start)
 |
 v
Business logic / services  (src/lib/services/*)
 |
 v
Supabase client  (src/lib/supabase/*)  -- RLS is enforced here, by Postgres itself
 |
 v
PostgreSQL (Supabase)
```

Nothing above the service layer talks to `supabase.from(...)` directly
for a write — every mutation goes through a named service function
(`patientService`, `appointmentService`, `ancService`, `riskService`,
`reportService`, `notificationService`, `pdfService`, `auditService`,
`userService`) so business rules live in one place and are unit-testable
without a browser. Reads inside Server Components are allowed to query
Supabase directly when there's no real business logic involved (e.g. the
dashboard's count queries) — introducing a service wrapper purely to
satisfy a rule, with nothing to abstract, would be needless indirection.

## Why Supabase (Postgres + Auth), and what "RLS is the real boundary" means

The project owner chose a hosted Supabase project over local Postgres,
which shapes two things:

1. **Auth lives in `auth.users`**, owned by Supabase; `public.users`
   (migration `20260101000002`) is a 1:1 profile row (name/role/status)
   that the app actually queries. No password ever touches our schema.
2. **Authorization is enforced in Postgres itself**, via Row Level
   Security policies (migration `20260101000009`), not only in
   `proxy.ts` or a page's `requireUser()`/`requireAdmin()` call.
   Those two exist purely for UX (redirect to `/login` instead of a
   confusing empty page/500) — the actual security boundary is that
   every server-side Supabase client runs *as the signed-in user's
   session*, so a bug in a page or Server Action cannot read or write
   anything RLS wouldn't have allowed anyway. The one exception,
   `lib/supabase/service.ts` (the service-role client), is reserved for
   the reminder cron job and admin user creation — both server-only,
   never reachable from the browser — and is guarded by the `server-only`
   package so an accidental client-side import fails the build rather
   than shipping a service-role key to a browser bundle.

## Key decisions that deviate from a literal reading of the brief

The brief is detailed but occasionally under-specifies or lists fields
in a way that would create data that goes stale or gets duplicated. Each
deviation is called out in the migration file it affects, and summarized
here:

- **Pregnancy-specific fields (gravida, para, LMP, EDD, gestational
  info) live on `pregnancies`, not `patients`.** The brief lists them
  under "patients" but *also* requires that a patient support more than
  one pregnancy episode over time (section 4, section 34 rule 2) —
  putting them on the patient row would make that impossible without
  destroying history. See migration `20260101000003`.
- **`age` is never stored.** It's derived from `date_of_birth` at
  display time so it can't go stale.
- **`patients.risk_status` is a denormalized rollup**, kept in sync from
  `risk_flags` by a trigger (`sync_patient_risk_status`, migration
  `20260101000007`). This trades a small amount of write-time complexity
  for cheap, indexable filtering on the patient list / high-risk
  dashboard — the alternative (aggregating `risk_flags` on every page
  load) doesn't scale as the flag history grows.
- **No clinical thresholds or ANC visit timing are seeded.** Sections 7,
  11 and 49 of the brief are explicit that thresholds and guideline
  timing must come from an administrator, not be invented. Migration
  `20260101000010` seeds the *structure* (8 visit slots, 5 named rule
  slots for weight/BP/fundal height/FHR/Hb) with `is_active = false` and
  `NULL` thresholds. The scheduling engine and rules engine (Phases 3–4)
  must treat an inactive/unconfigured rule as "don't evaluate it", never
  fall back to a guessed number.
- **Nothing is ever hard-deleted.** `patients`/`pregnancies` use
  `status`/`deleted_at`; `clinical_visits`, `risk_flags`, `reminders`,
  `audit_logs` and the rest have no soft-delete field because they
  should never disappear at all. A `prevent_delete()` trigger
  (migration `20260101000007`) enforces this even against a service-role
  connection, not just via missing RLS policies.
- **`clinical_visits` cannot be updated by a nurse, only inserted.**
  Section 10 says "do not silently alter entered clinical values" —
  RLS (migration `20260101000009`) gives nurses INSERT+SELECT only;
  correcting a mistake is an administrator action, which still leaves a
  paper trail because the table itself keeps `created_at`/`updated_at`
  and every correction should be paired with an audit log entry.
- **"Nurse: view assigned/relevant patients" is implemented as "any
  active staff member sees all patients."** Felis Clinic is one small
  clinic with a shared caseload, and the brief never introduces an
  assigned-nurse field anywhere else. If per-nurse assignment is wanted
  later, add `patients.assigned_nurse_id` and tighten the
  `patients_select` policy — it's a small, additive change from here.

## Notifications (WhatsApp, and later SMS/email)

Not built yet (Phase 5), but the shape is decided so schema and UI don't
have to change when it lands: `notificationService` will be a thin
facade over a `NotificationProvider` interface (`send(to, body) ->
{success, providerMessageId?, error?}`), selected at runtime by the
`WHATSAPP_PROVIDER` env var. The reminder scheduler and any "send
reminder now" button call the facade, never a specific provider's SDK —
swapping providers later is a new file implementing the interface plus
one env var change, not an application-wide rewrite. Message templates
are stored in `notification_templates` (editable by an administrator,
section 35) and rendered with `{{token}}` substitution; the rendered
text intentionally excludes diagnosis, measurements and risk detail
(section 9) by construction — the template can't reference fields the
renderer doesn't pass it.

## Testing

- **Unit** (Vitest, `src/**/*.test.ts`): pure logic — validation
  schemas, the navigation/access-control config, and (from Phase 3
  onward) the scheduling/risk/report calculations.
- **E2E** (Playwright, `e2e/*.spec.ts`): the primary workflows from
  section 30, added as each one becomes possible to drive end-to-end.
  Requires a configured Supabase project — see README "Running tests".

## Deployment

`Dockerfile` builds a standalone Next.js image (`next.config.ts` sets
`output: "standalone"`); `docker-compose.yml` runs just the app
container, since the database is the hosted Supabase project, not a
local container. See README "Deployment" for environment variables and
the migration-apply step.
