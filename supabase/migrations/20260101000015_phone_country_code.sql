-- Migration 0015 (Phase 5): WhatsApp reminders need a phone number in
-- WhatsApp's JID format (country code + number, no leading zero/plus),
-- but patients.phone/alternative_phone are free text (spec allows any
-- format a nurse is handed) — normalizing that free text requires
-- knowing which country's local-format numbers to assume. Rather than
-- hardcoding Zimbabwe's "263" in application code, this is an
-- administrator-editable clinic setting, same as clinic_name already
-- defaults to 'Felis Clinic' while staying editable.
alter table public.clinic_settings
  add column default_phone_country_code text not null default '263';

comment on column public.clinic_settings.default_phone_country_code is
  'Digits only, no plus sign — prepended to a local-format phone number (e.g. a leading-zero Zimbabwean number) when normalizing to a WhatsApp JID. See lib/services/notifications/phone.ts.';
