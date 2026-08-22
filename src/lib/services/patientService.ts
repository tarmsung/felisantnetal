import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent, diffForAudit } from "@/lib/services/auditService";
import { sweepMissedAppointments } from "@/lib/services/appointmentService";
import type { PatientRow, PregnancyRow } from "@/types/database";
import type { PatientFormInput, DuplicateCheckInput } from "@/lib/validation/patientSchemas";

export interface PatientListRow extends PatientRow {
  community_health_worker_name: string | null;
  edd: string | null;
}

const PAGE_SIZE = 20;

export interface SearchPatientsParams {
  query?: string;
  page?: number; // 1-based
}

export interface SearchPatientsResult {
  rows: PatientListRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * PostgREST's `.or()` takes a single comma/paren-delimited filter
 * string, so raw commas or parens in user input would silently break
 * (or maliciously extend) the filter. Patient names, numbers and phone
 * numbers never legitimately need those characters.
 */
function sanitizeForOrFilter(value: string): string {
  return value.replace(/[,()]/g, " ").trim();
}

export async function searchPatients({
  query,
  page = 1,
}: SearchPatientsParams): Promise<SearchPatientsResult> {
  const supabase = await createSupabaseServerClient();
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let builder = supabase
    .from("patients")
    .select("*", { count: "exact" })
    .is("deleted_at", null);

  const trimmed = query?.trim();
  if (trimmed) {
    const safe = sanitizeForOrFilter(trimmed);
    builder = builder.or(
      `full_name.ilike.%${safe}%,patient_number.ilike.%${safe}%,national_id.ilike.%${safe}%,phone.ilike.%${safe}%`,
    );
  }

  const { data, error, count } = await builder
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to search patients: ${error.message}`);
  }

  const rows = data ?? [];
  const chwIds = Array.from(
    new Set(
      rows
        .map((row) => row.community_health_worker_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const chwNameById = new Map<string, string>();
  if (chwIds.length > 0) {
    const { data: chwRows } = await supabase
      .from("community_health_workers")
      .select("id, full_name")
      .in("id", chwIds);
    for (const chw of chwRows ?? []) chwNameById.set(chw.id, chw.full_name);
  }

  // Latest EDD per patient, batched for the current page rather than
  // N+1 queries. Pregnancies are ordered newest-first so the first
  // occurrence per patient_id is the one to keep.
  const patientIds = rows.map((row) => row.id);
  const latestEddByPatientId = new Map<string, string | null>();
  if (patientIds.length > 0) {
    const { data: pregnancyRows } = await supabase
      .from("pregnancies")
      .select("patient_id, edd, pregnancy_number")
      .in("patient_id", patientIds)
      .order("pregnancy_number", { ascending: false });
    for (const pregnancy of pregnancyRows ?? []) {
      if (!latestEddByPatientId.has(pregnancy.patient_id)) {
        latestEddByPatientId.set(pregnancy.patient_id, pregnancy.edd);
      }
    }
  }

  return {
    rows: rows.map((row) => ({
      ...row,
      community_health_worker_name: row.community_health_worker_id
        ? (chwNameById.get(row.community_health_worker_id) ?? null)
        : null,
      edd: latestEddByPatientId.get(row.id) ?? null,
    })),
    total: count ?? 0,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}

/**
 * Spec section 5: check National ID, phone (either field), or exact
 * Name + DOB before creating a patient, and let the caller decide
 * whether to proceed rather than silently creating a duplicate.
 */
export async function checkDuplicatePatients(
  input: DuplicateCheckInput,
): Promise<PatientRow[]> {
  const supabase = await createSupabaseServerClient();
  const matches = new Map<string, PatientRow>();

  const identifierFilters: string[] = [];
  if (input.national_id) {
    identifierFilters.push(`national_id.eq.${sanitizeForOrFilter(input.national_id)}`);
  }
  if (input.phone) {
    const safePhone = sanitizeForOrFilter(input.phone);
    identifierFilters.push(`phone.eq.${safePhone}`, `alternative_phone.eq.${safePhone}`);
  }

  if (identifierFilters.length > 0) {
    const { data } = await supabase
      .from("patients")
      .select("*")
      .is("deleted_at", null)
      .or(identifierFilters.join(","))
      .limit(10);
    for (const row of data ?? []) matches.set(row.id, row);
  }

  if (input.full_name && input.date_of_birth) {
    const { data } = await supabase
      .from("patients")
      .select("*")
      .is("deleted_at", null)
      .ilike("full_name", input.full_name.trim())
      .eq("date_of_birth", input.date_of_birth)
      .limit(10);
    for (const row of data ?? []) matches.set(row.id, row);
  }

  return Array.from(matches.values());
}

export interface RegisterPatientResult {
  patientId: string;
}

/**
 * Creates the patient and its first pregnancy episode atomically via
 * the register_patient() Postgres function (migration 0011) — see that
 * migration's comment for why this isn't two sequential REST inserts.
 */
export async function registerPatient(
  input: PatientFormInput,
  actingUserId: string,
): Promise<RegisterPatientResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("register_patient", {
    p_full_name: input.full_name,
    p_national_id: input.national_id ?? null,
    p_date_of_birth: input.date_of_birth ?? null,
    p_phone: input.phone ?? null,
    p_alternative_phone: input.alternative_phone ?? null,
    p_address: input.address ?? null,
    p_emergency_contact_name: input.emergency_contact_name ?? null,
    p_emergency_contact_phone: input.emergency_contact_phone ?? null,
    p_community_health_worker_id: input.community_health_worker_id,
    p_notes: input.notes ?? null,
    p_gravida: input.gravida ?? null,
    p_para: input.para ?? null,
    p_lmp: input.lmp ?? null,
    p_edd: input.edd,
    p_gestational_information: input.gestational_information ?? null,
  });

  if (error || !data) {
    throw new Error(`Failed to register patient: ${error?.message ?? "unknown error"}`);
  }

  const patientId = data;

  await logAuditEvent({
    userId: actingUserId,
    action: "patient.create",
    entityType: "patient",
    entityId: patientId,
    newValues: {
      full_name: input.full_name,
      national_id: input.national_id ?? null,
      phone: input.phone ?? null,
      edd: input.edd,
      community_health_worker_id: input.community_health_worker_id,
    },
  });

  return { patientId };
}

export async function getPatientById(id: string): Promise<PatientRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`Failed to load patient: ${error.message}`);
  return data;
}

export async function getCommunityHealthWorkerName(id: string | null): Promise<string | null> {
  if (!id) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("community_health_workers")
    .select("full_name")
    .eq("id", id)
    .maybeSingle();
  return data?.full_name ?? null;
}

/** Most recent pregnancy episode — the one the profile page displays. */
export async function getLatestPregnancy(patientId: string): Promise<PregnancyRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pregnancies")
    .select("*")
    .eq("patient_id", patientId)
    .order("pregnancy_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load pregnancy: ${error.message}`);
  return data;
}

// Deliberately built from the Row types (nullable columns), not from
// PatientFormInput — the edit form always resubmits every field, so a
// blank field must become `null` in the database. PatientFormInput's
// `string | undefined` fields exist for the create flow, where
// `undefined` is resolved to `null` right before the register_patient()
// RPC call instead.
export interface UpdatePatientInput {
  patient: Partial<
    Pick<
      PatientRow,
      | "full_name"
      | "national_id"
      | "date_of_birth"
      | "phone"
      | "alternative_phone"
      | "address"
      | "emergency_contact_name"
      | "emergency_contact_phone"
      | "community_health_worker_id"
      | "notes"
    >
  >;
  pregnancy?: Partial<
    Pick<PregnancyRow, "gravida" | "para" | "lmp" | "edd" | "gestational_information">
  >;
}

/**
 * Edits demographic/pregnancy data (spec section 2: "Edit patient
 * information", both roles). This is distinct from clinical_visits,
 * which nurses cannot update at all (see migration 0009) — patient
 * demographics are expected to be corrected/updated over the course of
 * care, clinical measurements are not.
 */
export async function updatePatient(
  patientId: string,
  pregnancyId: string | null,
  input: UpdatePatientInput,
  actingUserId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: beforePatient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();

  if (Object.keys(input.patient).length > 0) {
    const { error } = await supabase
      .from("patients")
      .update({ ...input.patient, updated_by: actingUserId })
      .eq("id", patientId);
    if (error) throw new Error(`Failed to update patient: ${error.message}`);
  }

  if (input.pregnancy && pregnancyId && Object.keys(input.pregnancy).length > 0) {
    const { error } = await supabase
      .from("pregnancies")
      .update({ ...input.pregnancy, updated_by: actingUserId })
      .eq("id", pregnancyId);
    if (error) throw new Error(`Failed to update pregnancy: ${error.message}`);
  }

  if (beforePatient) {
    const { data: afterPatient } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .single();

    const diff = afterPatient ? diffForAudit(beforePatient, afterPatient) : null;
    if (diff) {
      await logAuditEvent({
        userId: actingUserId,
        action: "patient.update",
        entityType: "patient",
        entityId: patientId,
        ...diff,
      });
    }
  }
}

export interface PatientSummary {
  ancVisitsCompleted: number;
  ancVisitsConfigured: number;
  nextAppointmentDate: string | null;
  missedAppointments: number;
  activeRiskFlags: number;
}

/**
 * Backs the profile header's summary cards (spec section 6). Appointments/
 * clinical_visits/risk_flags all exist as tables since Phase 1 even
 * though their own modules (Phases 3-4) aren't built yet, so these are
 * real queries — legitimately all-zero on a fresh install, never
 * hardcoded to look populated (spec section 44).
 */
export async function getPatientSummary(patientId: string): Promise<PatientSummary> {
  await sweepMissedAppointments();
  const supabase = await createSupabaseServerClient();

  const [visitsCompleted, configuredTemplates, nextAppointment, missed, activeFlags] =
    await Promise.all([
      supabase
        .from("clinical_visits")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", patientId),
      supabase
        .from("anc_schedule_templates")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("appointments")
        .select("scheduled_date")
        .eq("patient_id", patientId)
        .eq("status", "scheduled")
        .order("scheduled_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", patientId)
        .eq("status", "missed"),
      supabase
        .from("risk_flags")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", patientId)
        .eq("status", "active"),
    ]);

  return {
    ancVisitsCompleted: visitsCompleted.count ?? 0,
    ancVisitsConfigured: configuredTemplates.count ?? 0,
    nextAppointmentDate: nextAppointment.data?.scheduled_date ?? null,
    missedAppointments: missed.count ?? 0,
    activeRiskFlags: activeFlags.count ?? 0,
  };
}
