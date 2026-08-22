-- Migration 0005: audit_logs
--
-- Append-only by construction (migration 0007 blocks UPDATE and DELETE
-- outright, even for administrators). Rows are written by the server-side
-- auditService after every mutation listed in spec section 4 (patient
-- create/edit, appointment create/change, clinical record change, risk
-- flag change, user change, report generation, login, notification action).

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id),
  action text not null, -- e.g. 'patient.create', 'appointment.reschedule', 'auth.login'
  entity_type text not null, -- e.g. 'patient', 'appointment', 'clinical_visit'
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
