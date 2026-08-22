-- Migration 0004: appointments, clinical_visits, risk_flags, reminders

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  pregnancy_id uuid not null references public.pregnancies (id) on delete cascade,
  visit_number integer, -- populated by the ANC scheduling engine (lib/services/ancService) against anc_schedule_templates; null for ad-hoc appointments
  scheduled_date timestamptz not null,
  appointment_type text not null default 'anc_visit', -- free text, not FK: supports both scheduled ANC visits (anc_schedule_templates.visit_key) and manually created ad-hoc appointment types
  status public.appointment_status not null default 'scheduled',
  reminder_status public.reminder_delivery_status not null default 'pending',
  reminder_sent_at timestamptz,
  completed_at timestamptz,
  rescheduled_from uuid references public.appointments (id), -- points at the original appointment; the original row is kept, never overwritten (spec section 7: "retain the original scheduled date")
  reschedule_reason text,
  cancellation_reason text,
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinical_visits (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id), -- nullable: a visit can be recorded without a prior appointment, but should be linked whenever possible (spec rule 7)
  patient_id uuid not null references public.patients (id) on delete cascade,
  pregnancy_id uuid not null references public.pregnancies (id) on delete cascade,
  visit_number integer not null,
  visit_date date not null default current_date,
  weight_kg numeric(5, 2),
  blood_pressure_systolic smallint,
  blood_pressure_diastolic smallint,
  fundal_height_cm numeric(4, 1),
  fetal_heart_rate smallint,
  hb_g_dl numeric(4, 1),
  clinical_notes text,
  risk_flag boolean not null default false, -- true once the rules engine (riskService) has raised at least one risk_flags row for this visit
  risk_reason text,
  recorded_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pregnancy_id, visit_number) -- guards against duplicate visit-number entries (spec section 10)
);

comment on table public.clinical_visits is
  'Append-only in practice: nurses may INSERT and SELECT, only administrators may UPDATE (RLS, migration 0009), and DELETE is blocked entirely (migration 0007). This protects historical clinical data per spec section 25.';

create table public.risk_flags (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  pregnancy_id uuid references public.pregnancies (id) on delete cascade,
  visit_id uuid references public.clinical_visits (id) on delete cascade,
  flag_type text not null, -- matches clinical_rules.rule_key at the time the flag was raised
  severity public.risk_severity not null,
  reason text not null,
  rule_version integer, -- clinical_rules.version snapshot, for traceability if the rule is later edited (spec section 11.4)
  status public.risk_flag_status not null default 'active',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users (id),
  review_notes text
);

comment on table public.risk_flags is
  'Never deleted (migration 0007). Only status/resolved_at/resolved_by/review_notes may be changed after creation (migration 0007 trigger) — the original flag, reason and severity are permanent history.';

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  channel public.reminder_channel not null default 'whatsapp',
  recipient text not null, -- snapshot of the phone number/handle used, not a live FK — a later phone number change must not rewrite delivery history
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  delivery_status public.reminder_delivery_status not null default 'pending',
  provider_message_id text,
  error_message text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now()
);
