/**
 * Hand-written types mirroring the SQL schema in /supabase/migrations.
 *
 * Once a live Supabase project is linked, these can be regenerated with
 * `supabase gen types typescript --linked > src/types/database.ts` — do
 * that periodically to catch drift, but keep the shape (Database ->
 * public -> Tables/Enums) the same so the rest of the app doesn't need
 * to change.
 *
 * IMPORTANT: every type below is declared with `type X = {...}`, never
 * `interface X {...}` — including the row types, not just `Database`
 * itself. `supabase-js`/`postgrest-js` resolve `.from(table).insert(...)`
 * through a chain of conditional/indexed-access types, and an
 * `interface` anywhere in that chain (even a plain flat one used only as
 * a `Row`/`Insert` type) makes that resolution collapse to `never` —
 * `.select()` degrades silently (property access on `never` doesn't
 * error), but `.insert()`/`.update()` fail hard with a confusing
 * "does not exist in type 'never[]'" error. `supabase gen types` always
 * emits `type`, never `interface`, for exactly this reason — match it.
 */

export type UserRole = "administrator" | "nurse";
export type UserStatus = "active" | "inactive";
export type ChwStatus = "active" | "inactive";
export type PatientStatus = "active" | "inactive" | "transferred";
export type RiskStatus = "normal" | "high_risk";
export type PregnancyStatus = "active" | "completed" | "transferred" | "miscarriage";
export type AppointmentStatus = "scheduled" | "completed" | "missed" | "cancelled" | "rescheduled";
export type ReminderChannel = "whatsapp" | "sms" | "email";
export type ReminderDeliveryStatus = "pending" | "sent" | "delivered" | "failed" | "not_applicable";
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskFlagStatus = "active" | "reviewed" | "resolved";
export type RuleOperator = "lt" | "lte" | "gt" | "gte" | "between" | "outside";

export type UserRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type CommunityHealthWorkerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  area: string | null;
  status: ChwStatus;
  created_at: string;
  updated_at: string;
};

export type PatientRow = {
  id: string;
  patient_number: string;
  full_name: string;
  national_id: string | null;
  date_of_birth: string | null;
  phone: string | null;
  alternative_phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  community_health_worker_id: string | null;
  status: PatientStatus;
  risk_status: RiskStatus;
  notes: string | null;
  registration_date: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PregnancyRow = {
  id: string;
  patient_id: string;
  pregnancy_number: number;
  gravida: number | null;
  para: number | null;
  lmp: string | null;
  edd: string | null;
  gestational_information: string | null;
  registration_date: string;
  status: PregnancyStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentRow = {
  id: string;
  patient_id: string;
  pregnancy_id: string;
  visit_number: number | null;
  scheduled_date: string;
  appointment_type: string;
  status: AppointmentStatus;
  reminder_status: ReminderDeliveryStatus;
  reminder_sent_at: string | null;
  completed_at: string | null;
  rescheduled_from: string | null;
  reschedule_reason: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicalVisitRow = {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  pregnancy_id: string;
  visit_number: number;
  visit_date: string;
  weight_kg: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  fundal_height_cm: number | null;
  fetal_heart_rate: number | null;
  hb_g_dl: number | null;
  clinical_notes: string | null;
  risk_flag: boolean;
  risk_reason: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
};

export type RiskFlagRow = {
  id: string;
  patient_id: string;
  pregnancy_id: string | null;
  visit_id: string | null;
  flag_type: string;
  severity: RiskSeverity;
  reason: string;
  rule_version: number | null;
  status: RiskFlagStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  review_notes: string | null;
};

export type ReminderRow = {
  id: string;
  appointment_id: string;
  patient_id: string;
  channel: ReminderChannel;
  recipient: string;
  scheduled_for: string;
  sent_at: string | null;
  delivery_status: ReminderDeliveryStatus;
  provider_message_id: string | null;
  error_message: string | null;
  attempt_count: number;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AncScheduleTemplateRow = {
  id: string;
  visit_number: number;
  visit_key: string;
  label: string;
  recommended_gestational_week: number | null;
  is_active: boolean;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicalRuleRow = {
  id: string;
  rule_key: string;
  label: string;
  field: string;
  operator: RuleOperator;
  threshold_min: number | null;
  threshold_max: number | null;
  severity: RiskSeverity;
  message: string;
  version: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationTemplateRow = {
  id: string;
  channel: ReminderChannel;
  template_key: string;
  body_template: string;
  is_active: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicSettingsRow = {
  id: true;
  clinic_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  default_phone_country_code: string;
  updated_by: string | null;
  updated_at: string;
};

export type NotificationSettingsRow = {
  id: true;
  reminder_hours_before: number;
  retry_max_attempts: number;
  retry_backoff_minutes: number;
  whatsapp_provider: string | null;
  updated_by: string | null;
  updated_at: string;
};

/**
 * Shaped to satisfy @supabase/postgrest-js's GenericSchema constraint
 * (Tables + Views + Functions at the schema level; Row + Insert + Update
 * + Relationships per table) so `.from(...)`/`.select(...)`/`.insert(...)`
 * infer real types instead of silently collapsing to `never`. There are
 * no Views yet, and no table's Relationships are modeled (we don't do
 * embedded/joined `.select()` calls yet) — `[]` for Relationships and
 * `Record<string, never>` for Views are accurate placeholders for "none
 * defined", not shortcuts. Functions lists each Postgres function the
 * app calls via `.rpc(...)` (currently just register_patient, migration
 * 0011) with its real Args/Returns shape — add new ones here as they're
 * added as migrations.
 */
type Table<Row, Insert, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: Table<UserRow, Partial<UserRow> & { id: string; full_name: string; email: string }>;
      community_health_workers: Table<CommunityHealthWorkerRow, Partial<CommunityHealthWorkerRow> & { full_name: string }>;
      patients: Table<PatientRow, Partial<PatientRow> & { full_name: string }>;
      pregnancies: Table<PregnancyRow, Partial<PregnancyRow> & { patient_id: string }>;
      appointments: Table<AppointmentRow, Partial<AppointmentRow> & { patient_id: string; pregnancy_id: string; scheduled_date: string }>;
      clinical_visits: Table<ClinicalVisitRow, Partial<ClinicalVisitRow> & { patient_id: string; pregnancy_id: string; visit_number: number; recorded_by: string }>;
      risk_flags: Table<RiskFlagRow, Partial<RiskFlagRow> & { patient_id: string; flag_type: string; severity: RiskSeverity; reason: string }>;
      reminders: Table<ReminderRow, Partial<ReminderRow> & { appointment_id: string; patient_id: string; recipient: string; scheduled_for: string }>;
      audit_logs: Table<AuditLogRow, Partial<AuditLogRow> & { action: string; entity_type: string }, Record<string, never>>;
      anc_schedule_templates: Table<AncScheduleTemplateRow, Partial<AncScheduleTemplateRow> & { visit_number: number; visit_key: string; label: string }>;
      clinical_rules: Table<ClinicalRuleRow, Partial<ClinicalRuleRow> & { rule_key: string; label: string; field: string; operator: RuleOperator }>;
      notification_templates: Table<NotificationTemplateRow, Partial<NotificationTemplateRow> & { channel: ReminderChannel; template_key: string; body_template: string }>;
      clinic_settings: Table<ClinicSettingsRow, Partial<ClinicSettingsRow>>;
      notification_settings: Table<NotificationSettingsRow, Partial<NotificationSettingsRow>>;
    };
    Views: Record<string, never>;
    Functions: {
      register_patient: {
        Args: {
          p_full_name: string;
          p_national_id: string | null;
          p_date_of_birth: string | null;
          p_phone: string | null;
          p_alternative_phone: string | null;
          p_address: string | null;
          p_emergency_contact_name: string | null;
          p_emergency_contact_phone: string | null;
          p_community_health_worker_id: string;
          p_notes: string | null;
          p_gravida: number | null;
          p_para: number | null;
          p_lmp: string | null;
          p_edd: string;
          p_gestational_information: string | null;
        };
        Returns: string;
      };
    };
  };
};
