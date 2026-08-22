-- Migration 0013: fix sync_patient_risk_status's missing enum cast
--
-- Bug found via live testing in Phase 4, the first time a risk_flags row
-- was ever inserted against a real database (Phases 1-3 never raised
-- one, so this was invisible until now). The trigger's SET clause built
-- 'high_risk'/'normal' via a bare CASE expression:
--
--   set risk_status = case when has_active then 'high_risk' else 'normal' end
--
-- Postgres resolves an all-string-literal CASE's type as `text`, not the
-- `unknown` type a single bare literal gets — and there is no implicit
-- assignment cast from `text` to a user-defined enum. Every UPDATE this
-- trigger actually needed to perform (i.e. whenever risk_status was
-- really changing, per the WHERE guard) therefore failed with:
--   column "risk_status" is of type risk_status but expression is of type text
--
-- The WHERE clause's own comparison CASE already had the correct
-- `::public.risk_status` casts (migration 0007) — only the SET clause
-- was missing them. This re-creates the function with both branches
-- cast explicitly; the trigger itself (migration 0007) already points
-- at this function by name, so it does not need to be re-created.

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
    set risk_status = case when has_active then 'high_risk'::public.risk_status else 'normal'::public.risk_status end
    where id = target_patient_id
      and risk_status is distinct from (case when has_active then 'high_risk'::public.risk_status else 'normal'::public.risk_status end);

  return null;
end;
$$;
