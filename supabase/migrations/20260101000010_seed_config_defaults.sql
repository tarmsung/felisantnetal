-- Migration 0010: default configuration rows
--
-- These are STRUCTURAL defaults only (the 8 visit slots the spec
-- requires, the notification settings the spec explicitly states, and
-- the exact WhatsApp message template the project owner supplied
-- verbatim in section 9). No clinical threshold or gestational-week
-- timing is seeded — those stay NULL / is_active = false until an
-- administrator enters an approved value via Settings (spec section 35).

insert into public.anc_schedule_templates (visit_number, visit_key, label, recommended_gestational_week, is_active, notes)
values
  (1, 'anc_visit_1', 'ANC Visit 1', null, true, 'Recommended gestational week not yet configured. Set this against the clinic''s approved ANC guideline in Settings before the scheduling engine will suggest a date automatically.'),
  (2, 'anc_visit_2', 'ANC Visit 2', null, true, 'Recommended gestational week not yet configured.'),
  (3, 'anc_visit_3', 'ANC Visit 3', null, true, 'Recommended gestational week not yet configured.'),
  (4, 'anc_visit_4', 'ANC Visit 4', null, true, 'Recommended gestational week not yet configured.'),
  (5, 'anc_visit_5', 'ANC Visit 5', null, true, 'Recommended gestational week not yet configured.'),
  (6, 'anc_visit_6', 'ANC Visit 6', null, true, 'Recommended gestational week not yet configured.'),
  (7, 'anc_visit_7', 'ANC Visit 7', null, true, 'Recommended gestational week not yet configured.'),
  (8, 'anc_visit_8', 'ANC Visit 8', null, true, 'Recommended gestational week not yet configured.');

-- Placeholder rule slots for the five measurements the spec names
-- explicitly (weight, BP, fundal height, FHR, Hb). Each is inactive with
-- no threshold until an administrator supplies one — see spec section 11.
insert into public.clinical_rules (rule_key, label, field, operator, threshold_min, threshold_max, severity, message, is_active)
values
  ('systolic_bp_high', 'Elevated systolic blood pressure', 'blood_pressure_systolic', 'gte', null, null, 'high', 'Clinical review required: systolic blood pressure outside the configured range.', false),
  ('diastolic_bp_high', 'Elevated diastolic blood pressure', 'blood_pressure_diastolic', 'gte', null, null, 'high', 'Clinical review required: diastolic blood pressure outside the configured range.', false),
  ('low_hb', 'Low haemoglobin', 'hb_g_dl', 'lt', null, null, 'medium', 'Clinical review required: haemoglobin below the configured threshold.', false),
  ('abnormal_fhr', 'Abnormal fetal heart rate', 'fetal_heart_rate', 'outside', null, null, 'high', 'Clinical review required: fetal heart rate outside the configured range.', false),
  ('low_fundal_height', 'Fundal height below expected range', 'fundal_height_cm', 'lt', null, null, 'medium', 'Clinical review required: fundal height below the configured threshold for gestational age.', false);

-- The reminder message text below is quoted verbatim from spec section 9,
-- not invented here.
insert into public.notification_templates (channel, template_key, body_template, is_active)
values (
  'whatsapp',
  'appointment_reminder',
  'Hello {{patient_name}}, this is a reminder from Felis Clinic that your ANC visit is scheduled for {{appointment_date}} at Felis Clinic. Please contact the clinic if you need to reschedule.',
  true
);

insert into public.clinic_settings (id, clinic_name, address, phone, email, logo_url)
values (true, 'Felis Clinic', 'Marondera, Zimbabwe', null, null, '/brand/felis-logo.png');

-- 48 hours is stated explicitly in spec section 9. Retry settings are
-- operational, not clinical, defaults (spec section 27) and remain
-- administrator-editable.
insert into public.notification_settings (id, reminder_hours_before, retry_max_attempts, retry_backoff_minutes)
values (true, 48, 3, 30);
