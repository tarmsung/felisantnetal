-- Migration 0008: indexes
-- Matches spec section 32, plus trigram indexes so global search (section
-- 17) can do fast partial/ILIKE matches without pulling every patient row
-- into the frontend.

-- Patients: exact-match and partial search
create index idx_patients_national_id on public.patients (national_id);
create index idx_patients_phone on public.patients (phone);
create index idx_patients_full_name_trgm on public.patients using gin (full_name gin_trgm_ops);
create index idx_patients_national_id_trgm on public.patients using gin (national_id gin_trgm_ops);
create index idx_patients_phone_trgm on public.patients using gin (phone gin_trgm_ops);
create index idx_patients_status on public.patients (status) where deleted_at is null;
create index idx_patients_risk_status on public.patients (risk_status) where deleted_at is null;
create index idx_patients_chw on public.patients (community_health_worker_id);

-- Pregnancies
create index idx_pregnancies_patient_id on public.pregnancies (patient_id);
create index idx_pregnancies_status on public.pregnancies (status);

-- Appointments: the calendar, "today's schedule" and missed-visit queries
-- all filter by status/date range together, hence the composite index.
create index idx_appointments_patient_id on public.appointments (patient_id);
create index idx_appointments_pregnancy_id on public.appointments (pregnancy_id);
create index idx_appointments_scheduled_date on public.appointments (scheduled_date);
create index idx_appointments_status on public.appointments (status);
create index idx_appointments_status_date on public.appointments (status, scheduled_date);

-- Clinical visits
create index idx_clinical_visits_patient_id on public.clinical_visits (patient_id);
create index idx_clinical_visits_visit_date on public.clinical_visits (visit_date);
create index idx_clinical_visits_pregnancy_id on public.clinical_visits (pregnancy_id);
create index idx_clinical_visits_appointment_id on public.clinical_visits (appointment_id);

-- Risk flags
create index idx_risk_flags_patient_id on public.risk_flags (patient_id);
create index idx_risk_flags_status on public.risk_flags (status);
create index idx_risk_flags_status_severity on public.risk_flags (status, severity);

-- Reminders: the 48h reminder cron scans by delivery_status + scheduled_for
create index idx_reminders_appointment_id on public.reminders (appointment_id);
create index idx_reminders_status_scheduled on public.reminders (delivery_status, scheduled_for);

-- Audit logs: chronological + per-entity lookups
create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index idx_audit_logs_user_id on public.audit_logs (user_id);
create index idx_audit_logs_created_at on public.audit_logs (created_at desc);
