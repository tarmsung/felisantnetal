-- Migration 0003: patients & pregnancies
--
-- DESIGN NOTE (deviates from the literal spec field list, intentionally):
-- The spec lists gravida/para/gestational_information/LMP/EDD under
-- "patients", but also explicitly requires (section 4, "pregnancies";
-- section 34 rule 2) that a patient be able to have more than one
-- pregnancy episode over time. Storing pregnancy-specific data on the
-- patient row would make it impossible to keep a second pregnancy's LMP/
-- EDD without destroying the first pregnancy's history. Those fields
-- therefore live on public.pregnancies (one-to-many from patients), which
-- is the normalized shape the spec itself calls for elsewhere. `age` is
-- likewise not stored — it is derived from date_of_birth at query/display
-- time so it can never go stale.

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  patient_number text not null unique, -- auto-generated, see migration 0007 (format FEL-ANC-000001)
  full_name text not null,
  national_id text,
  date_of_birth date,
  phone text,
  alternative_phone text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  community_health_worker_id uuid references public.community_health_workers (id),
  status public.patient_status not null default 'active',
  risk_status public.risk_status not null default 'normal', -- denormalized rollup, kept in sync by trigger (0007) from risk_flags
  notes text,
  registration_date date not null default current_date,
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz -- soft delete only; hard DELETE is blocked (migration 0007)
);

comment on column public.patients.risk_status is
  'Denormalized for fast dashboard/list filtering. Source of truth is risk_flags; kept consistent by trigger sync_patient_risk_status().';

create table public.pregnancies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  pregnancy_number integer not null, -- auto-incremented per patient by trigger (0007) if not supplied
  gravida integer,
  para integer,
  lmp date, -- last menstrual period
  edd date, -- estimated date of delivery
  gestational_information text,
  registration_date date not null default current_date,
  status public.pregnancy_status not null default 'active',
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, pregnancy_number)
);
