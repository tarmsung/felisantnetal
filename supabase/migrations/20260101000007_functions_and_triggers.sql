-- Migration 0007: functions & triggers
-- Business rules that must hold no matter which code path writes to the
-- database (server action, cron job, or a future direct SQL fix) belong
-- here, not only in the application layer.

------------------------------------------------------------------------
-- updated_at maintenance
------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger trg_chw_updated_at before update on public.community_health_workers
  for each row execute function public.set_updated_at();
create trigger trg_patients_updated_at before update on public.patients
  for each row execute function public.set_updated_at();
create trigger trg_pregnancies_updated_at before update on public.pregnancies
  for each row execute function public.set_updated_at();
create trigger trg_appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
create trigger trg_clinical_visits_updated_at before update on public.clinical_visits
  for each row execute function public.set_updated_at();
create trigger trg_anc_templates_updated_at before update on public.anc_schedule_templates
  for each row execute function public.set_updated_at();
create trigger trg_clinical_rules_updated_at before update on public.clinical_rules
  for each row execute function public.set_updated_at();
create trigger trg_notification_templates_updated_at before update on public.notification_templates
  for each row execute function public.set_updated_at();

------------------------------------------------------------------------
-- patient_number generation: FEL-ANC-000001, FEL-ANC-000002, ...
------------------------------------------------------------------------
create sequence public.patient_number_seq start 1;

create or replace function public.set_patient_number()
returns trigger
language plpgsql
as $$
begin
  if new.patient_number is null then
    new.patient_number := 'FEL-ANC-' || lpad(nextval('public.patient_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_patients_set_number before insert on public.patients
  for each row execute function public.set_patient_number();

------------------------------------------------------------------------
-- pregnancy_number: auto-increment per patient (1, 2, 3, ...) so repeat
-- pregnancies are supported without the caller having to compute it.
------------------------------------------------------------------------
create or replace function public.set_pregnancy_number()
returns trigger
language plpgsql
as $$
declare
  next_number integer;
begin
  if new.pregnancy_number is null then
    select coalesce(max(pregnancy_number), 0) + 1 into next_number
      from public.pregnancies
      where patient_id = new.patient_id;
    new.pregnancy_number := next_number;
  end if;
  return new;
end;
$$;

create trigger trg_pregnancies_set_number before insert on public.pregnancies
  for each row execute function public.set_pregnancy_number();

------------------------------------------------------------------------
-- patients.risk_status: denormalized rollup kept consistent from
-- risk_flags, so list/dashboard queries can filter on patients directly
-- instead of joining+aggregating risk_flags on every page load.
------------------------------------------------------------------------
create or replace function public.sync_patient_risk_status()
returns trigger
language plpgsql
as $$
declare
  target_patient_id uuid := coalesce(new.patient_id, old.patient_id);
  has_active boolean;
begin
  select exists (
    select 1 from public.risk_flags
    where patient_id = target_patient_id and status = 'active'
  ) into has_active;

  update public.patients
    set risk_status = case when has_active then 'high_risk' else 'normal' end
    where id = target_patient_id
      and risk_status is distinct from (case when has_active then 'high_risk'::public.risk_status else 'normal'::public.risk_status end);

  return null;
end;
$$;

create trigger trg_risk_flags_sync_patient
  after insert or update or delete on public.risk_flags
  for each row execute function public.sync_patient_risk_status();

------------------------------------------------------------------------
-- risk_flags immutability: the flag itself (what/why/how severe/when)
-- is permanent history. Only the review workflow columns may change.
------------------------------------------------------------------------
create or replace function public.protect_risk_flag_history()
returns trigger
language plpgsql
as $$
begin
  if new.flag_type is distinct from old.flag_type
     or new.severity is distinct from old.severity
     or new.reason is distinct from old.reason
     or new.patient_id is distinct from old.patient_id
     or new.pregnancy_id is distinct from old.pregnancy_id
     or new.visit_id is distinct from old.visit_id
     or new.rule_version is distinct from old.rule_version
     or new.created_at is distinct from old.created_at then
    raise exception 'risk_flags: only status, resolved_at, resolved_by and review_notes may change after creation.';
  end if;
  return new;
end;
$$;

create trigger trg_risk_flags_protect before update on public.risk_flags
  for each row execute function public.protect_risk_flag_history();

------------------------------------------------------------------------
-- Generic guards: never hard-delete health records, and never mutate
-- the append-only audit log. These fire even for a service-role
-- connection, which is the one client that bypasses RLS.
------------------------------------------------------------------------
create or replace function public.prevent_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Deletion is not permitted on % — use a status or soft-delete field instead.', tg_table_name;
end;
$$;

create or replace function public.prevent_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Updates are not permitted on %.', tg_table_name;
end;
$$;

create trigger trg_users_no_delete before delete on public.users
  for each row execute function public.prevent_delete();
create trigger trg_chw_no_delete before delete on public.community_health_workers
  for each row execute function public.prevent_delete();
create trigger trg_patients_no_delete before delete on public.patients
  for each row execute function public.prevent_delete();
create trigger trg_pregnancies_no_delete before delete on public.pregnancies
  for each row execute function public.prevent_delete();
create trigger trg_appointments_no_delete before delete on public.appointments
  for each row execute function public.prevent_delete();
create trigger trg_clinical_visits_no_delete before delete on public.clinical_visits
  for each row execute function public.prevent_delete();
create trigger trg_risk_flags_no_delete before delete on public.risk_flags
  for each row execute function public.prevent_delete();
create trigger trg_reminders_no_delete before delete on public.reminders
  for each row execute function public.prevent_delete();
create trigger trg_audit_logs_no_delete before delete on public.audit_logs
  for each row execute function public.prevent_delete();
create trigger trg_audit_logs_no_update before update on public.audit_logs
  for each row execute function public.prevent_update();
