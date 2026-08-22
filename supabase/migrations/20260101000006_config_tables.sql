-- Migration 0006: configurable clinical & operational settings
--
-- IMPORTANT: this migration intentionally does NOT seed real clinical
-- thresholds or gestational-week timings. Per spec sections 7, 11 and 49
-- ("Do not invent medical thresholds", "Do not fabricate clinical
-- guidelines"), those values must come from the clinic's approved
-- guideline and be entered by an administrator through Settings
-- (spec section 35). Default rows are inserted in migration 0010 with
-- is_active = false and NULL thresholds until that happens.

create table public.anc_schedule_templates (
  id uuid primary key default gen_random_uuid(),
  visit_number integer not null unique,
  visit_key text not null unique, -- e.g. 'anc_visit_1'; referenced loosely by appointments.appointment_type
  label text not null,
  recommended_gestational_week integer, -- NULL until an administrator configures it
  is_active boolean not null default true,
  notes text,
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.anc_schedule_templates is
  'Central configuration for the ANC visit schedule (spec section 7). The scheduling engine (lib/services/ancService) reads this table instead of hardcoding visit timing.';

create table public.clinical_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  label text not null,
  field text not null, -- column on clinical_visits this rule evaluates, e.g. 'blood_pressure_systolic'
  operator public.rule_operator not null,
  threshold_min numeric,
  threshold_max numeric,
  severity public.risk_severity not null default 'medium',
  message text not null default 'Clinical review required.',
  version integer not null default 1,
  is_active boolean not null default false, -- inactive until an administrator supplies approved thresholds
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clinical_rules is
  'The configurable rules engine (spec section 11). riskService evaluates only rules where is_active = true, and records rule_version on every risk_flags row it creates.';

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  channel public.reminder_channel not null,
  template_key text not null,
  body_template text not null,
  is_active boolean not null default true,
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, template_key)
);

comment on table public.notification_templates is
  'Editable by an administrator (spec section 9/35). Placeholders use {{snake_case}} tokens — see lib/services/notificationService.ts for the render step. Never include diagnosis, measurements or risk detail in a template body (spec section 9).';

-- Singleton settings tables: a boolean primary key defaulting to / checked
-- against `true` is a standard Postgres trick to guarantee exactly one row.

create table public.clinic_settings (
  id boolean primary key default true check (id),
  clinic_name text not null default 'Felis Clinic',
  address text,
  phone text,
  email text,
  logo_url text,
  updated_by uuid references public.users (id),
  updated_at timestamptz not null default now()
);

create table public.notification_settings (
  id boolean primary key default true check (id),
  reminder_hours_before integer not null default 48,
  retry_max_attempts integer not null default 3,
  retry_backoff_minutes integer not null default 30,
  whatsapp_provider text,
  updated_by uuid references public.users (id),
  updated_at timestamptz not null default now()
);

comment on table public.notification_settings is
  'reminder_hours_before defaults to 48 per spec section 9 ("approximately 48 hours before"). retry_max_attempts/retry_backoff_minutes are operational defaults, not clinical values, and are administrator-editable.';
