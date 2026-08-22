-- Felis Clinic ANC Management System
-- Migration 0001: extensions & enumerated types
--
-- This is the first of several migrations that together define the full
-- schema described in the project's database design (see /database/ERD.md
-- for the entity-relationship overview). Run these in order — either via
-- `supabase db push` (after `supabase link`) or by pasting each file, in
-- order, into the Supabase SQL Editor.

-- pg_trgm powers fast partial-text search (patient name / ID / phone)
-- without loading full tables into the frontend — see migration 0008.
create extension if not exists pg_trgm;

-- gen_random_uuid() is built into Postgres 13+, no extension required.

create type public.user_role as enum ('administrator', 'nurse');
create type public.user_status as enum ('active', 'inactive');
create type public.chw_status as enum ('active', 'inactive');
create type public.patient_status as enum ('active', 'inactive', 'transferred');
create type public.risk_status as enum ('normal', 'high_risk');
create type public.pregnancy_status as enum ('active', 'completed', 'transferred', 'miscarriage');
create type public.appointment_status as enum ('scheduled', 'completed', 'missed', 'cancelled', 'rescheduled');
create type public.reminder_channel as enum ('whatsapp', 'sms', 'email');
create type public.reminder_delivery_status as enum ('pending', 'sent', 'delivered', 'failed', 'not_applicable');
create type public.risk_severity as enum ('low', 'medium', 'high', 'critical');
create type public.risk_flag_status as enum ('active', 'reviewed', 'resolved');
create type public.rule_operator as enum ('lt', 'lte', 'gt', 'gte', 'between', 'outside');
