-- Migration 0011 (Phase 2): register_patient()
--
-- Registering a patient always creates two rows — patients and its first
-- pregnancies episode — and both must succeed or neither should. A
-- plain pair of sequential REST inserts from the app can't guarantee
-- that (a failed second insert would leave an orphaned patient with no
-- pregnancy record), so this wraps both in one Postgres function, which
-- Postgres runs as a single transaction for free.
--
-- Deliberately NOT `security definer`: it runs as whoever calls it, so
-- the patients_insert / pregnancies_insert RLS policies (migration 0009)
-- still apply exactly as if the two inserts had been made directly —
-- this function does not grant any privilege beyond what the caller
-- already has.

create or replace function public.register_patient(
  p_full_name text,
  p_national_id text,
  p_date_of_birth date,
  p_phone text,
  p_alternative_phone text,
  p_address text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_community_health_worker_id uuid,
  p_notes text,
  p_gravida integer,
  p_para integer,
  p_lmp date,
  p_edd date,
  p_gestational_information text
)
returns uuid
language plpgsql
as $$
declare
  v_patient_id uuid;
begin
  insert into public.patients (
    full_name, national_id, date_of_birth, phone, alternative_phone,
    address, emergency_contact_name, emergency_contact_phone,
    community_health_worker_id, notes, created_by, updated_by
  ) values (
    p_full_name, p_national_id, p_date_of_birth, p_phone, p_alternative_phone,
    p_address, p_emergency_contact_name, p_emergency_contact_phone,
    p_community_health_worker_id, p_notes, auth.uid(), auth.uid()
  )
  returning id into v_patient_id;

  insert into public.pregnancies (
    patient_id, gravida, para, lmp, edd, gestational_information,
    created_by, updated_by
  ) values (
    v_patient_id, p_gravida, p_para, p_lmp, p_edd, p_gestational_information,
    auth.uid(), auth.uid()
  );

  return v_patient_id;
end;
$$;

grant execute on function public.register_patient(
  text, text, date, text, text, text, text, text, uuid, text,
  integer, integer, date, date, text
) to authenticated;
