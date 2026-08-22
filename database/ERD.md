# Entity-Relationship Overview

Source of truth is always the migrations in
[`/supabase/migrations`](../supabase/migrations) — this file is a map to
help navigate them, not a spec in its own right. See
[`ARCHITECTURE.md`](../ARCHITECTURE.md) for why a few fields sit on a
different table than the project brief literally listed them under.

```mermaid
erDiagram
    USERS ||--o{ PATIENTS : "created_by / updated_by"
    USERS ||--o{ AUDIT_LOGS : "acted as"
    COMMUNITY_HEALTH_WORKERS ||--o{ PATIENTS : "supports"
    PATIENTS ||--o{ PREGNANCIES : "has episodes"
    PREGNANCIES ||--o{ APPOINTMENTS : "schedules"
    PREGNANCIES ||--o{ CLINICAL_VISITS : "records"
    PATIENTS ||--o{ APPOINTMENTS : "attends"
    PATIENTS ||--o{ CLINICAL_VISITS : "attends"
    PATIENTS ||--o{ RISK_FLAGS : "flagged for"
    PATIENTS ||--o{ REMINDERS : "notified"
    APPOINTMENTS ||--o| CLINICAL_VISITS : "fulfilled by"
    APPOINTMENTS ||--o{ REMINDERS : "triggers"
    APPOINTMENTS ||--o| APPOINTMENTS : "rescheduled_from"
    CLINICAL_VISITS ||--o{ RISK_FLAGS : "raises"
    ANC_SCHEDULE_TEMPLATES ..> APPOINTMENTS : "configures (by key, not FK)"
    CLINICAL_RULES ..> RISK_FLAGS : "configures (by key, not FK)"
    NOTIFICATION_TEMPLATES ..> REMINDERS : "renders message for"

    USERS {
        uuid id PK
        text full_name
        text email
        user_role role
        user_status status
    }
    PATIENTS {
        uuid id PK
        text patient_number
        text full_name
        patient_status status
        risk_status risk_status
        timestamptz deleted_at
    }
    PREGNANCIES {
        uuid id PK
        uuid patient_id FK
        int pregnancy_number
        date lmp
        date edd
        pregnancy_status status
    }
    APPOINTMENTS {
        uuid id PK
        uuid patient_id FK
        uuid pregnancy_id FK
        int visit_number
        timestamptz scheduled_date
        appointment_status status
        uuid rescheduled_from FK
    }
    CLINICAL_VISITS {
        uuid id PK
        uuid appointment_id FK
        uuid patient_id FK
        uuid pregnancy_id FK
        int visit_number
        numeric weight_kg
        smallint blood_pressure_systolic
        smallint blood_pressure_diastolic
        numeric fundal_height_cm
        smallint fetal_heart_rate
        numeric hb_g_dl
        boolean risk_flag
    }
    RISK_FLAGS {
        uuid id PK
        uuid patient_id FK
        uuid visit_id FK
        text flag_type
        risk_severity severity
        risk_flag_status status
        int rule_version
    }
    REMINDERS {
        uuid id PK
        uuid appointment_id FK
        reminder_channel channel
        reminder_delivery_status delivery_status
    }
    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        text action
        text entity_type
        uuid entity_id
        jsonb old_values
        jsonb new_values
    }
    ANC_SCHEDULE_TEMPLATES {
        uuid id PK
        int visit_number
        text visit_key
        int recommended_gestational_week
        boolean is_active
    }
    CLINICAL_RULES {
        uuid id PK
        text rule_key
        text field
        rule_operator operator
        numeric threshold_min
        numeric threshold_max
        boolean is_active
        int version
    }
    NOTIFICATION_TEMPLATES {
        uuid id PK
        reminder_channel channel
        text body_template
    }
    COMMUNITY_HEALTH_WORKERS {
        uuid id PK
        text full_name
        chw_status status
    }
```

## Migration order

1. `20260101000001_extensions_and_enums.sql` — `pg_trgm`, all enum types.
2. `20260101000002_core_tables.sql` — `users`, `community_health_workers`.
3. `20260101000003_patients_and_pregnancies.sql`
4. `20260101000004_appointments_and_clinical.sql` — `appointments`,
   `clinical_visits`, `risk_flags`, `reminders`.
5. `20260101000005_audit_logs.sql`
6. `20260101000006_config_tables.sql` — `anc_schedule_templates`,
   `clinical_rules`, `notification_templates`, `clinic_settings`,
   `notification_settings`.
7. `20260101000007_functions_and_triggers.sql` — `updated_at`
   maintenance, patient/pregnancy numbering, the `risk_status` rollup,
   history-immutability guards.
8. `20260101000008_indexes.sql`
9. `20260101000009_rls_policies.sql` — the actual authorization
   boundary; see ARCHITECTURE.md.
10. `20260101000010_seed_config_defaults.sql` — structural defaults only
    (no invented clinical thresholds — see ARCHITECTURE.md).

## Tables NOT in this schema (intentionally, per the brief's scope)

Billing, payments, pharmacy, inpatient/ward management, DHIS2
integration, and laboratory system integration are explicitly out of
scope (brief section 42) and have no tables here.
