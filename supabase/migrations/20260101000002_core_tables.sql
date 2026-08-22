-- Migration 0002: users & community health workers
--
-- public.users mirrors auth.users 1:1 (id is a FK to auth.users.id).
-- Supabase Auth owns credentials (password hashes, sessions, MFA); this
-- table only holds the application-facing profile: name, role, status.
-- Never store a password or password hash here.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  role public.user_role not null default 'nurse',
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

comment on table public.users is
  'Application profile for a staff member. Credentials live in auth.users; this row only carries role/status/display info.';

create table public.community_health_workers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  area text,
  status public.chw_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.community_health_workers is
  'Community health workers are referenced by patients.community_health_worker_id but do not log into the system themselves (out of scope per spec).';
