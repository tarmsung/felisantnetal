-- Migration 0009: Row Level Security
--
-- Spec section "MODULE A" and section 21 require authorization to be
-- enforced on the backend/database, not only in frontend route guards.
-- This migration is that enforcement. The app's server-side Supabase
-- client (lib/supabase/server.ts) always runs as the signed-in user's
-- session, so every one of these policies is what actually decides what
-- a request can read or write — a compromised or buggy UI cannot bypass
-- it. The one exception is the cron/service-role client (lib/supabase/
-- service.ts), which is used ONLY by trusted server-only jobs (the
-- reminder scheduler) and never reachable from the browser.
--
-- Interpretation note: the spec's nurse permissions say "assigned/
-- relevant patients". Felis Clinic is a single small clinic with a
-- shared caseload and the spec never introduces an assigned-nurse field,
-- so this is implemented as "all active staff can see all patients".
-- If per-nurse patient assignment is wanted later, add an
-- assigned_nurse_id column and tighten the patients policy below.

------------------------------------------------------------------------
-- Helper functions (security definer so they can read public.users
-- regardless of the calling user's own row-level access to it).
------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_app_role() = 'administrator';
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and status = 'active'
  );
$$;

------------------------------------------------------------------------
-- Enable + force RLS on every table (force = even the table owner's
-- direct queries are subject to it; service_role still bypasses this by
-- design, which is why it must stay server-only).
------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.users force row level security;
alter table public.community_health_workers enable row level security;
alter table public.community_health_workers force row level security;
alter table public.patients enable row level security;
alter table public.patients force row level security;
alter table public.pregnancies enable row level security;
alter table public.pregnancies force row level security;
alter table public.appointments enable row level security;
alter table public.appointments force row level security;
alter table public.clinical_visits enable row level security;
alter table public.clinical_visits force row level security;
alter table public.risk_flags enable row level security;
alter table public.risk_flags force row level security;
alter table public.reminders enable row level security;
alter table public.reminders force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
alter table public.anc_schedule_templates enable row level security;
alter table public.anc_schedule_templates force row level security;
alter table public.clinical_rules enable row level security;
alter table public.clinical_rules force row level security;
alter table public.notification_templates enable row level security;
alter table public.notification_templates force row level security;
alter table public.clinic_settings enable row level security;
alter table public.clinic_settings force row level security;
alter table public.notification_settings enable row level security;
alter table public.notification_settings force row level security;

------------------------------------------------------------------------
-- users: administrators manage everyone; a user may always read (not
-- write) their own row so the app can render "logged in as ...".
------------------------------------------------------------------------
create policy users_select on public.users
  for select using (id = auth.uid() or public.is_admin());
create policy users_insert_admin on public.users
  for insert with check (public.is_admin());
create policy users_update_admin on public.users
  for update using (public.is_admin()) with check (public.is_admin());

------------------------------------------------------------------------
-- community_health_workers: readable by any active staff (needed for
-- patient registration dropdowns), writable by administrators only.
------------------------------------------------------------------------
create policy chw_select on public.community_health_workers
  for select using (public.is_active_staff());
create policy chw_insert_admin on public.community_health_workers
  for insert with check (public.is_admin());
create policy chw_update_admin on public.community_health_workers
  for update using (public.is_admin()) with check (public.is_admin());

------------------------------------------------------------------------
-- patients / pregnancies: any active staff member may read, register
-- and edit. No delete policy exists for anyone (soft delete via
-- status/deleted_at only), and migration 0007 blocks hard DELETE too.
------------------------------------------------------------------------
create policy patients_select on public.patients
  for select using (public.is_active_staff());
create policy patients_insert on public.patients
  for insert with check (public.is_active_staff());
create policy patients_update on public.patients
  for update using (public.is_active_staff()) with check (public.is_active_staff());

create policy pregnancies_select on public.pregnancies
  for select using (public.is_active_staff());
create policy pregnancies_insert on public.pregnancies
  for insert with check (public.is_active_staff());
create policy pregnancies_update on public.pregnancies
  for update using (public.is_active_staff()) with check (public.is_active_staff());

------------------------------------------------------------------------
-- appointments: staff can schedule, reschedule, cancel, complete.
------------------------------------------------------------------------
create policy appointments_select on public.appointments
  for select using (public.is_active_staff());
create policy appointments_insert on public.appointments
  for insert with check (public.is_active_staff());
create policy appointments_update on public.appointments
  for update using (public.is_active_staff()) with check (public.is_active_staff());

------------------------------------------------------------------------
-- clinical_visits: staff may record (insert) and read. Only an
-- administrator may correct an existing entry (spec section 10: "Do not
-- silently alter entered clinical values" — a nurse's own typo fix
-- should go through an admin-reviewed correction, not a silent edit).
-- There is deliberately no nurse UPDATE policy at all.
------------------------------------------------------------------------
create policy clinical_visits_select on public.clinical_visits
  for select using (public.is_active_staff());
create policy clinical_visits_insert on public.clinical_visits
  for insert with check (public.is_active_staff());
create policy clinical_visits_update_admin on public.clinical_visits
  for update using (public.is_admin()) with check (public.is_admin());

------------------------------------------------------------------------
-- risk_flags: staff can read, the system/staff can raise a flag, and
-- staff can move it through the review workflow (status/resolved_*/
-- review_notes only — enforced by the protect_risk_flag_history trigger,
-- migration 0007). Never deletable by anyone.
------------------------------------------------------------------------
create policy risk_flags_select on public.risk_flags
  for select using (public.is_active_staff());
create policy risk_flags_insert on public.risk_flags
  for insert with check (public.is_active_staff());
create policy risk_flags_update on public.risk_flags
  for update using (public.is_active_staff()) with check (public.is_active_staff());

------------------------------------------------------------------------
-- reminders: staff can read and manually trigger one; only an
-- administrator can otherwise edit a reminder row (e.g. to correct a
-- stuck delivery status). The cron job writes as service_role, which
-- bypasses RLS entirely and is not represented by a policy here.
------------------------------------------------------------------------
create policy reminders_select on public.reminders
  for select using (public.is_active_staff());
create policy reminders_insert on public.reminders
  for insert with check (public.is_active_staff());
create policy reminders_update_admin on public.reminders
  for update using (public.is_admin()) with check (public.is_admin());

------------------------------------------------------------------------
-- audit_logs: append-only. Any active staff member may insert an entry
-- attributed to themselves (server actions do this after every
-- mutation); only administrators may read the log (spec section 6:
-- "Audit History: Authorized users can view changes"). Narrowing this
-- further to "staff can see audit entries for patients they can access"
-- is a reasonable future enhancement, not implemented in Phase 1.
------------------------------------------------------------------------
create policy audit_logs_insert on public.audit_logs
  for insert with check (public.is_active_staff() and (user_id = auth.uid() or user_id is null));
create policy audit_logs_select_admin on public.audit_logs
  for select using (public.is_admin());

------------------------------------------------------------------------
-- Configurable clinical/operational settings: any active staff may
-- read (the UI needs these to render schedules/rules/templates),
-- only administrators may write (spec section 35).
------------------------------------------------------------------------
create policy anc_templates_select on public.anc_schedule_templates
  for select using (public.is_active_staff());
create policy anc_templates_write on public.anc_schedule_templates
  for insert with check (public.is_admin());
create policy anc_templates_update on public.anc_schedule_templates
  for update using (public.is_admin()) with check (public.is_admin());

create policy clinical_rules_select on public.clinical_rules
  for select using (public.is_active_staff());
create policy clinical_rules_write on public.clinical_rules
  for insert with check (public.is_admin());
create policy clinical_rules_update on public.clinical_rules
  for update using (public.is_admin()) with check (public.is_admin());

create policy notification_templates_select on public.notification_templates
  for select using (public.is_active_staff());
create policy notification_templates_write on public.notification_templates
  for insert with check (public.is_admin());
create policy notification_templates_update on public.notification_templates
  for update using (public.is_admin()) with check (public.is_admin());

create policy clinic_settings_select on public.clinic_settings
  for select using (public.is_active_staff());
create policy clinic_settings_write on public.clinic_settings
  for insert with check (public.is_admin());
create policy clinic_settings_update on public.clinic_settings
  for update using (public.is_admin()) with check (public.is_admin());

create policy notification_settings_select on public.notification_settings
  for select using (public.is_active_staff());
create policy notification_settings_write on public.notification_settings
  for insert with check (public.is_admin());
create policy notification_settings_update on public.notification_settings
  for update using (public.is_admin()) with check (public.is_admin());
