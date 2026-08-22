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
| 1 | Project setup: schema, architecture, design system, auth skeleton | **Done** |
| 2 | Patient management: registration, search, profile | **Done** |
| 3 | ANC scheduling: engine, calendar, rescheduling, missed visits | **Done** |
| 4 | Clinical records: visit recording, validation, risk flag engine | **Done** |
| 5 | WhatsApp reminders: notification service, scheduler, delivery logs | **Deferred** — skipped ahead to Phase 6 at the project owner's request; nothing in Phase 6 depends on it |
| 6 | Dashboard and reports: metrics, charts, filters | **Done** (this checkpoint) |
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
- **Rescheduling never moves an appointment's date — it creates a new
  row.** Section 7 says the original scheduled date must be retained.
  `appointmentService.rescheduleAppointment()` marks the original
  `rescheduled` (untouched otherwise) and inserts a new appointment with
  `rescheduled_from` pointing back at it, so both the original commitment
  and the change are permanently on record, not overwritten.
- **Missed-appointment detection runs inline on read, not on a cron.**
  Section 27 lists this as a background job, but Phase 3 doesn't build
  cron infrastructure — that's bundled with Phase 5's reminders. Until
  then, `appointmentService.sweepMissedAppointments()` (a plain `UPDATE
  ... WHERE status = 'scheduled' AND scheduled_date < now()`) runs at
  the top of every read path that shows appointment status (the
  calendar, missed visits, dashboard, a patient's summary cards), so
  `status` never drifts from reality regardless of which page a staff
  member happens to open first. It attributes its audit log entries to
  `user_id: null` (RLS's `audit_logs_insert` policy explicitly allows
  this) since no staff member actually took the action. Replace the call
  sites with a real scheduled job in Phase 5 without changing the
  function itself.
- **A missed appointment is still fully actionable, not a dead end.**
  The first version of `AppointmentDetailSheet` only showed Complete/
  Reschedule/Cancel for `status === "scheduled"`, hiding them for
  `"missed"` — but spec section 13 explicitly lists "Mark completed,
  Reschedule, Contact patient, Add note" as the actions on a *missed*
  visit, which is exactly the case the Missed Visits page exists to
  help resolve. Fixed to `canResolve = status === "scheduled" ||
  status === "missed"`; only "Mark missed" itself stays restricted to
  `"scheduled"` (re-marking an already-missed visit is a no-op).
- **Recording a clinical visit against an appointment completes that
  appointment as part of the same action**, rather than leaving the
  nurse to separately click "Mark completed" afterwards
  (`clinicalVisitService.recordVisit`, spec section 7 — a visit is the
  real-world event an appointment exists to track). It only does this
  for `scheduled`/`missed` appointments; a visit can also be recorded
  with no appointment at all (a walk-in), in which case there's nothing
  to complete.
- **Correcting a visit (administrator-only) does not re-run the risk
  rules engine.** `risk_flags` are permanent history of what was
  believed true *at the time* (migration `20260101000007`'s
  `protect_risk_flag_history`), and silently raising or retracting a
  flag as a side effect of a data correction would bypass the human
  review the flag review workflow (below) exists for. If a correction
  changes a value enough to matter clinically, that's a manual judgement
  call via the Risk Flags tab, not something the correction form does
  for you.

## The ANC scheduling engine, and what it does when nothing is configured

`ancService.suggestNextVisit()` is the concrete answer to spec section
7's "the scheduling engine should determine recommended dates according
to the configured guideline" — but migration `20260101000010` seeded
every `anc_schedule_templates` row with `recommended_gestational_week =
NULL` (see "Key decisions" above: no guideline values are invented).
So the engine always resolves which visit number is next (by comparing
against the pregnancy's existing appointments), and separately, *only if*
both a gestational week is configured **and** the pregnancy's LMP is on
file, computes a suggested calendar day as `LMP + N weeks` — plain
obstetric arithmetic, not a guessed date. Whichever piece is missing, it
returns a `reasonNoSuggestion` string instead of guessing, and
`AddAppointmentDialog` surfaces that text directly under the date field
rather than silently leaving it unexplained. Once Settings (Phase 8)
lets an administrator fill in `recommended_gestational_week` for each
visit, suggestions start appearing automatically — no code change
required, because the engine was written against the configured case
from the start rather than bolted on later.

## The clinical rules engine, and its threshold convention

`riskService.evaluateAndFlagVisit()` is Phase 4's answer to spec section
11 — it runs a just-recorded `clinical_visits` row through every *active*
`clinical_rules` row and raises a `risk_flags` row per match, recording
`rule_version` for traceability. Same philosophy as the scheduling engine
above: migration `20260101000010` seeds five rule slots (weight, BP ×2,
fundal height, FHR, Hb) with `is_active = false` and every threshold
`NULL`, so on a fresh install this engine runs and finds nothing to
raise — not because it's broken, but because no administrator has
configured a threshold yet (Phase 8's Settings module will let them).

The pure evaluation logic lives in `riskRules.ts`, deliberately split out
from `riskService.ts` (which owns the Supabase reads/writes and imports
`"server-only"`) so it has no such import and is directly unit-testable
the same way `lib/dates.ts`/`lib/calendar.ts` are (see
`riskRules.test.ts`) — a service file can't be imported from a Vitest
file that also gets pulled into a client bundle graph, since
`server-only` throws in that context.

**Threshold convention** (an implementation decision this project made,
not something the spec dictates): `clinical_rules` has `threshold_min`
and `threshold_max`, but three of the six operators (`lt`/`lte`/`gt`/
`gte`) are single-sided and only need one number. This project reads
`threshold_min` as *the* configured cutoff for all four single-sided
operators — `threshold_max` is ignored for those and only matters
together with `threshold_min` for the two two-sided operators
(`between`/`outside`, e.g. an FHR that's abnormal both too low and too
high). A rule that's active but missing the threshold(s) its own
operator needs simply never triggers rather than throwing — that's an
administrator misconfiguration to fix in Settings, not a reason to
break visit recording for every nurse until they do.

## The reporting module: date ranges, bucketing, and what's real vs. deferred

Phase 6 was built ahead of Phase 5 (WhatsApp reminders) at the project
owner's request — nothing here depends on reminders/notifications
existing; every chart and report is built from `patients`/
`appointments`/`clinical_visits`/`risk_flags`, all populated since
Phases 1–4. The one casualty is a "reminder delivery" report, which
will slot in as a fifth Reports tab once Phase 5 lands, showing
honestly-empty data until then rather than being faked.

`lib/reportRange.ts` resolves a preset ("Last 30 days", "This month",
etc.) or an explicit custom start/end into a clinic-local `[startKey,
endKey]` day-key pair, and separately picks week-vs-month bucket
granularity for trend charts (more than ~90 days of range switches from
weekly to monthly bars, so a 12-month chart doesn't render 52
illegibly-thin bars). It's pure and directly unit-tested
(`reportRange.test.ts`) the same way `lib/dates.ts`/`lib/calendar.ts`
are, taking "today" as a parameter rather than reading the clock itself.

`lib/services/reportService.ts` fetches the rows in range and
buckets/aggregates them in JS rather than pushing `GROUP BY` into
Postgres via raw SQL — deliberately, for a single small clinic's
volume: the query is simple, the result is easy to reason about, and
there's no realistic near-term data volume where this stops being fast
enough. Each report function (`getAttendanceReport`,
`getHighRiskReport`, `getMissedVisitReport`, `getPatientSummaryReport`)
returns both the aggregated shape a chart/summary card needs *and* the
underlying flat rows, so the Reports page's CSV export
(`ExportCsvButton`) can build a CSV client-side from data already
fetched server-side — no second round trip just to reformat what the
page already has.

## Clinic timezone handling

Every other date in this schema (`date_of_birth`, EDD, LMP,
`registration_date`) is a plain Postgres `date` with no time component,
so "which calendar day" is the only question and `lib/dates.ts`'s
`parseDateOnly`-style local-construction avoids a UTC-parse/local-format
round trip shifting it by a day. `appointments.scheduled_date` is
different — a real `timestamptz` where the *time* matters — which
introduces a question those date-only fields never raise: whose
timezone? `lib/dates.ts` fixes this at `CLINIC_TIMEZONE =
"Africa/Harare"` (fixed UTC+2, no DST) and:

- `clinicLocalDateTimeToIso()` converts a `<input type="datetime-local">`
  value into a UTC instant *as clinic-local time*, regardless of the
  browser's own timezone — never `new Date(localString).toISOString()`,
  which would silently use the browser's/server's zone instead.
- `formatClinicDateTime()` / `formatClinicTime()` do the reverse for
  display, via `Intl`'s `timeZone` option, so a viewer in a different
  timezone still sees the appointment's Harare wall-clock time, not
  their own.
- `lib/calendar.ts`'s day/week/month range boundaries are all computed
  in clinic-local time too — "today" and "this week" must mean Harare's
  calendar, not the Node process's.

If Felis Clinic ever operates across multiple timezones, the fixed
`+02:00` offset in `clinicLocalDateTimeToIso` would need to become a
real IANA-aware conversion (a library, since `Date` can't parse a
wall-clock string against a zone name natively) — not needed for this
single-clinic deployment, but noted so it isn't mistaken for an
oversight.

## Multi-row writes: a Postgres function, not sequential REST calls

Registering a patient creates two rows — `patients` and its first
`pregnancies` episode — that must succeed or fail together. Supabase's
REST API has no multi-statement transaction, so `patientService
.registerPatient()` calls `register_patient()` (migration `20260101000011`),
a plain `plpgsql` function that does both inserts and lets Postgres's own
per-call transaction handle atomicity. It's deliberately **not**
`security definer` — it runs as whoever calls it, so the same
`patients_insert`/`pregnancies_insert` RLS policies apply as if the two
inserts had been made directly. Reach for this pattern again any time a
feature needs more than one table to change together *and* a half-done
result would actually be broken data.

Phase 4's "recording a visit completes its appointment" does touch two
tables, but deliberately stays as two separate sequential calls
(`clinicalVisitService.recordVisit()` inserts the visit, then calls
`appointmentService.completeAppointment()`) rather than one RPC — unlike
a patient with no pregnancy, an appointment still `scheduled` after its
visit was successfully recorded isn't corrupt, just slightly stale
denormalization. The risk-evaluation step in the same function follows
the opposite reasoning again (see "Working with this stack" below): it's
wrapped in its own `try/catch` specifically so *its* failure can't undo
or block the already-successful visit insert.

## Working with this stack: known rough edges

Found by actually driving the app in a browser against the live
database, not just by lint/typecheck/build passing — worth knowing
before Phase 3+ hits the same walls again:

- **Base UI's `Select.Value` does not derive a label from the matching
  `Select.Item`.** Unlike Radix, it shows the raw `value` unless given
  a render-function child: `<SelectValue>{(value) => label}</SelectValue>`.
  Every `<Select>` in this codebase (see `patient-form.tsx`) uses this;
  copy that pattern, not a bare `<SelectValue placeholder="..." />`.
- **`zodResolver`/`standardSchemaResolver` + a schema whose input type
  differs from its output type (any `.transform()`) fights
  react-hook-form's own generics.** Every combination of explicit
  `useForm<...>` generics we tried produced the same class of error
  (`Control<...>` "two different types with this name exist"). The
  working pattern, used in `patient-form.tsx`: type `useForm` with only
  the raw (pre-transform) shape, and cast once at the `handleSubmit`
  boundary where the real (post-transform) value is handed to the
  caller. Don't spend time re-deriving this per form — reuse the pattern.
- **A server action that receives already-parsed data needs a schema
  built for that shape, not the form's raw-string schema re-run.**
  `patientOutputSchema` exists because re-validating a real `number`
  through a schema whose field starts `z.string()...` rejects it
  outright. Any future "call the server action directly with structured
  data" flow needs its own output-shaped schema the same way.
- **`diffForAudit()`'s return type is deliberately `Pick<AuditLogInput,
  ...>`, not an inline object literal.** It used to return
  `{old_values, new_values}` (matching the DB column names) while
  `logAuditEvent()` expected `{oldValues, newValues}`; spreading the
  mismatched object into a call silently dropped both fields, and
  every audit entry recorded `null` for months of would-be usage before
  it was caught by reading an actual audit trail, not by the type
  checker (TS's excess-property check doesn't apply to spread
  arguments). Any new "shape produced here, spread into a call there"
  helper should tie its return type to the consumer's type the same way.
- **Resetting several `useState` fields at once on a prop/open change
  belongs to a `key`, not an effect.** `AddAppointmentDialog`'s form
  needs a full reset every time it opens (cleared fields, re-run patient
  search, etc.). The first version did this with a `useEffect` that
  called half a dozen setters — exactly the "cascading renders" pattern
  `react-hooks/set-state-in-effect` exists to catch, and also just more
  code. The fix: split the dialog shell (owns `open` only) from an inner
  form component, and mount the form with `key={sessionId}` where
  `sessionId` increments only when the dialog *opens* (not on close, so
  the closing animation doesn't visibly reset mid-fade). A fresh key
  means a fresh component instance with fresh `useState` initial values
  — no reset effect needed at all. Reuse this for any future dialog/form
  that needs "start over" semantics (Phase 4's visit form included).
- **A "selected row" opened in a detail sheet should be an id, not a
  copy of the row.** The first version of `AppointmentDetailSheet`'s
  callers (`AppointmentCalendar`, `MissedVisitsTable`,
  `PatientAppointments`) stored the whole selected `AppointmentListRow`
  in state. Live-tested consequence: clicking "Mark completed" or "Add
  note" correctly updated the database and called `router.refresh()`,
  but the *already-open* sheet kept showing the stale pre-action data
  until closed and reopened, because the fresh server data landed in
  the `appointments` prop while the separately-stored `selected` copy
  never got told about it. The fix in all three: store `selectedId`
  and derive `appointments.find(a => a.id === selectedId)` during
  render. No effect, no sync bug, and a resolved row (rescheduled away,
  cancelled) naturally disappears from a filtered list like Missed
  Visits instead of the sheet showing a ghost of it.
- **A bare-string-literal `CASE` inside an `UPDATE ... SET` for an enum
  column resolves as `text`, not the target enum — and there's no
  implicit cast.** `sync_patient_risk_status()` (migration
  `20260101000007`) built `risk_status = case when has_active then
  'high_risk' else 'normal' end` with no cast on either branch. Its
  `WHERE ... IS DISTINCT FROM (case ... ::public.risk_status ... end)`
  guard *did* cast correctly, which is exactly why this stayed invisible
  through Phases 1–3: the trigger only ever ran with `has_active =
  false`→`false` (no `risk_flags` row had ever existed yet), so the
  `WHERE` guard's `IS DISTINCT FROM` was always false and the broken
  `SET` clause never actually executed. The instant Phase 4 raised the
  first-ever `risk_flags` row live, the guard flipped true, the `UPDATE`
  ran, and it failed with `column "risk_status" is of type risk_status
  but expression is of type text` — fixed in migration `20260101000013`
  by casting both `SET`-clause branches the same way the `WHERE` clause
  already did. Lesson: a literal used inside a `CASE` does not inherit
  the "unknown → infer from context" treatment a bare literal gets: cast
  every enum-producing branch explicitly, always.
- **A side-effect that runs after the "real" write must not be able to
  make the whole action look like it failed.** The bug above surfaced
  through `clinicalVisitService.recordVisit()` throwing *after* the
  `clinical_visits` row had already been successfully inserted — so the
  nurse saw "failed to record visit" while the visit had, in fact, been
  saved (just without risk evaluation). Recording it again would have
  hit the `(pregnancy_id, visit_number)` unique constraint, or worse,
  the nurse might have given up entirely, leaving a real elevated
  reading both saved *and* silently unflagged. Fixed by wrapping the
  `evaluateAndFlagVisit()` call in its own `try/catch`: a risk-evaluation
  failure now still reports the visit as recorded, with a distinct
  `riskEvaluationError` surfaced to the UI ("recorded, but risk
  evaluation could not be completed — an administrator should review
  it") instead of either silently swallowing it (too quiet for a missed
  clinical risk) or throwing (too loud for what's actually a secondary
  effect of a primary action that already succeeded).
- **recharts' `<ResponsiveContainer>` can measure its container mid-layout
  and then never re-measure, painting the wrong size forever.** Found
  live (Phase 6): a donut/bar chart below the fold rendered as a
  completely blank card — but `getBoundingClientRect`/`getComputedStyle`
  on its SVG showed correct geometry, fill colors, and hit-testing the
  whole time. A real window resize instantly fixed every chart on the
  page at once, which was the giveaway: `ResizeObserver` (what
  `ResponsiveContainer` uses internally) only fires again on an actual
  subsequent size *change* of the observed element, not because the
  first reading was wrong — and Next.js SSR/hydration can finish a
  chart's container layout without ever producing such a change.
  Fixed by not using `ResponsiveContainer` at all:
  `components/reports/chart-container.tsx` runs its own `ResizeObserver`
  on a plain wrapper div, renders nothing until the first real
  measurement lands, and hands `{width, height}` straight to recharts'
  chart components. Every chart in `components/reports/` uses this —
  reach for it, not `ResponsiveContainer`, for any future chart.
- **A flex child needs explicit `min-w-0` before its own
  `overflow-x-auto` wrapper can do anything.** Found live (Phase 6): the
  High Risk report's table has a `reason` cell with a long, unbroken
  (`truncate`, i.e. `white-space: nowrap`) string. Browsers compute a
  flex item's default `min-width` as `auto`, which means "at least as
  wide as your widest content's min-content size" — *even inside* an
  `overflow-x-auto` wrapper, since `overflow-x-auto` only starts
  scrolling once the container has a definite width to overflow
  against. With no `min-w-0` anywhere in the app shell's sidebar/main
  flex row (`app/(app)/layout.tsx`), that one table's intrinsic width
  propagated all the way up through every ancestor, forcing the entire
  page to scroll horizontally instead of just that one table. Invisible
  through Phases 1–5 because no earlier table had a single unbroken
  string that long. Fixed by adding `min-w-0` to the shell's main
  content column and `<main>` itself — the fix belongs in the shared
  shell, not the one table, since the next long string (a clinical note,
  an audit log diff) would trip the same failure anywhere else in the app.

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
