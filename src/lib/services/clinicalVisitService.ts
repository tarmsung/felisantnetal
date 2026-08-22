import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent, diffForAudit } from "@/lib/services/auditService";
import { completeAppointment } from "@/lib/services/appointmentService";
import { evaluateAndFlagVisit } from "@/lib/services/riskService";
import type { ClinicalVisitRow, RiskFlagRow, RiskStatus } from "@/types/database";

export interface ClinicalVisitWithRecorder extends ClinicalVisitRow {
  recorded_by_name: string;
}

export interface ClinicalVisitListRow extends ClinicalVisitWithRecorder {
  patient_full_name: string;
  patient_number: string;
  patient_risk_status: RiskStatus;
}

/** Every visit_number already recorded for this pregnancy (any visit) — feeds ancService.suggestNextVisitNumber and blocks a duplicate entry client-side before the DB's unique constraint would. */
export async function getRecordedVisitNumbers(pregnancyId: string): Promise<number[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clinical_visits")
    .select("visit_number")
    .eq("pregnancy_id", pregnancyId);

  if (error) throw new Error(`Failed to load recorded visits: ${error.message}`);
  return (data ?? []).map((row) => row.visit_number);
}

/** Same "fetch, then one batched `.in()` lookup" pattern as auditService/appointmentService — no postgrest embedding, see types/database.ts. */
async function attachRecorderNames(rows: ClinicalVisitRow[]): Promise<ClinicalVisitWithRecorder[]> {
  if (rows.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const userIds = Array.from(new Set(rows.map((r) => r.recorded_by)));
  const { data: users } = await supabase.from("users").select("id, full_name").in("id", userIds);
  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  return rows.map((row) => ({ ...row, recorded_by_name: nameById.get(row.recorded_by) ?? "Unknown user" }));
}

async function attachPatientAndRecorder(rows: ClinicalVisitRow[]): Promise<ClinicalVisitListRow[]> {
  const withRecorder = await attachRecorderNames(rows);
  if (withRecorder.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const patientIds = Array.from(new Set(rows.map((r) => r.patient_id)));
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, patient_number, risk_status")
    .in("id", patientIds);
  const byId = new Map((patients ?? []).map((p) => [p.id, p]));

  return withRecorder.map((row) => {
    const patient = byId.get(row.patient_id);
    return {
      ...row,
      patient_full_name: patient?.full_name ?? "Unknown patient",
      patient_number: patient?.patient_number ?? "—",
      patient_risk_status: patient?.risk_status ?? "normal",
    };
  });
}

export async function listVisitsForPatient(patientId: string): Promise<ClinicalVisitWithRecorder[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clinical_visits")
    .select("*")
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false })
    .order("visit_number", { ascending: false });

  if (error) throw new Error(`Failed to load visits: ${error.message}`);
  return attachRecorderNames(data ?? []);
}

const VISITS_PAGE_SIZE = 20;

export interface ListRecentVisitsResult {
  rows: ClinicalVisitListRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Backs the clinic-wide "ANC Visits" page (nav item, spec section 43 Phase 4) — every visit recorded, most recent first. */
export async function listRecentVisits(page = 1): Promise<ListRecentVisitsResult> {
  const supabase = await createSupabaseServerClient();
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * VISITS_PAGE_SIZE;
  const to = from + VISITS_PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("clinical_visits")
    .select("*", { count: "exact" })
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Failed to load visits: ${error.message}`);
  const rows = await attachPatientAndRecorder(data ?? []);
  return { rows, total: count ?? 0, page: safePage, pageSize: VISITS_PAGE_SIZE };
}

export async function getVisitById(id: string): Promise<ClinicalVisitListRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("clinical_visits").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(`Failed to load visit: ${error.message}`);
  if (!data) return null;
  const [row] = await attachPatientAndRecorder([data]);
  return row ?? null;
}

export interface RecordVisitInput {
  patientId: string;
  pregnancyId: string;
  appointmentId?: string;
  visitNumber: number;
  visitDate: string;
  weightKg?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  fundalHeightCm?: number;
  fetalHeartRate?: number;
  hbGDl?: number;
  clinicalNotes?: string;
}

export interface RecordVisitResult {
  visit: ClinicalVisitRow;
  riskFlags: RiskFlagRow[];
  /** Set when the visit itself recorded fine but risk evaluation blew up (e.g. a database error) — surfaced rather than silently swallowed, since a real risk could have gone undetected. */
  riskEvaluationError?: string;
}

/**
 * Records a clinical visit, evaluates it against the configured risk
 * rules (riskService), and — if this visit was recorded against a
 * scheduled/missed appointment — completes that appointment as part of
 * the same action rather than leaving the nurse to do it separately
 * (spec section 7: a visit is the real-world event an appointment
 * exists to track). clinical_visits has no nurse UPDATE policy at all
 * (migration 0009), so this is deliberately create-only; a mistaken
 * entry is corrected by an administrator via updateVisitAdmin below,
 * never silently overwritten here.
 */
export async function recordVisit(
  input: RecordVisitInput,
  actingUserId: string,
): Promise<RecordVisitResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("clinical_visits")
    .insert({
      appointment_id: input.appointmentId ?? null,
      patient_id: input.patientId,
      pregnancy_id: input.pregnancyId,
      visit_number: input.visitNumber,
      visit_date: input.visitDate,
      weight_kg: input.weightKg ?? null,
      blood_pressure_systolic: input.bloodPressureSystolic ?? null,
      blood_pressure_diastolic: input.bloodPressureDiastolic ?? null,
      fundal_height_cm: input.fundalHeightCm ?? null,
      fetal_heart_rate: input.fetalHeartRate ?? null,
      hb_g_dl: input.hbGDl ?? null,
      clinical_notes: input.clinicalNotes ?? null,
      recorded_by: actingUserId,
    })
    .select("*")
    .single();

  if (error || !data) {
    // Postgres unique_violation — clinical_visits' (pregnancy_id, visit_number) constraint (migration 0004).
    if (error?.code === "23505") {
      throw new Error(`Visit ${input.visitNumber} has already been recorded for this pregnancy.`);
    }
    throw new Error(`Failed to record visit: ${error?.message ?? "unknown error"}`);
  }

  await logAuditEvent({
    userId: actingUserId,
    action: "clinical_visit.create",
    entityType: "clinical_visit",
    entityId: data.id,
    newValues: {
      visit_number: data.visit_number,
      visit_date: data.visit_date,
      weight_kg: data.weight_kg,
      blood_pressure_systolic: data.blood_pressure_systolic,
      blood_pressure_diastolic: data.blood_pressure_diastolic,
      fundal_height_cm: data.fundal_height_cm,
      fetal_heart_rate: data.fetal_heart_rate,
      hb_g_dl: data.hb_g_dl,
      appointment_id: data.appointment_id,
    },
  });

  // The visit itself is already safely recorded at this point (spec
  // section 24: robust error handling) — a bug or transient failure in
  // risk evaluation must never make a nurse think the visit wasn't
  // saved, or worse, prompt a re-entry attempt that collides with the
  // (pregnancy_id, visit_number) unique constraint. It's surfaced back
  // to the caller rather than silently swallowed like a failed audit
  // write (auditService.logAuditEvent), though, since an undetected
  // risk here is a bigger problem than an undetected error there.
  let riskFlags: RiskFlagRow[] = [];
  let riskEvaluationError: string | undefined;
  try {
    riskFlags = await evaluateAndFlagVisit(data, actingUserId);
  } catch (err) {
    console.error("[clinicalVisitService] risk evaluation failed:", err);
    riskEvaluationError =
      "The visit was recorded, but risk evaluation could not be completed — an administrator should review it.";
  }

  if (input.appointmentId) {
    const { data: appointment } = await supabase
      .from("appointments")
      .select("status")
      .eq("id", input.appointmentId)
      .maybeSingle();
    if (appointment && (appointment.status === "scheduled" || appointment.status === "missed")) {
      await completeAppointment(input.appointmentId, actingUserId);
    }
  }

  const visit =
    riskFlags.length > 0
      ? { ...data, risk_flag: true, risk_reason: riskFlags.map((f) => f.reason).join(" | ") }
      : data;

  return { visit, riskFlags, riskEvaluationError };
}

export interface UpdateVisitInput {
  weightKg?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  fundalHeightCm?: number;
  fetalHeartRate?: number;
  hbGDl?: number;
  clinicalNotes?: string;
}

/**
 * Administrator-only correction of an existing visit (RLS backs this up
 * independently — migration 0009's clinical_visits_update_admin is the
 * only UPDATE policy on the table). Deliberately does NOT re-run
 * riskService against the corrected values: risk_flags are permanent
 * history of what was believed true at the time (migration 0007's
 * protect_risk_flag_history), and silently raising or "un-raising" a
 * flag as a side effect of a data correction would bypass the human
 * review the flag review workflow exists for. If a correction changes
 * a value enough to matter clinically, review it manually via the
 * Risk Flags tab.
 */
export async function updateVisitAdmin(
  visitId: string,
  input: UpdateVisitInput,
  reason: string,
  actingUserId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: before, error: fetchError } = await supabase
    .from("clinical_visits")
    .select("*")
    .eq("id", visitId)
    .single();
  if (fetchError || !before) throw new Error(`Visit not found: ${fetchError?.message ?? "unknown error"}`);

  const { error } = await supabase
    .from("clinical_visits")
    .update({
      weight_kg: input.weightKg ?? null,
      blood_pressure_systolic: input.bloodPressureSystolic ?? null,
      blood_pressure_diastolic: input.bloodPressureDiastolic ?? null,
      fundal_height_cm: input.fundalHeightCm ?? null,
      fetal_heart_rate: input.fetalHeartRate ?? null,
      hb_g_dl: input.hbGDl ?? null,
      clinical_notes: input.clinicalNotes ?? null,
    })
    .eq("id", visitId);
  if (error) throw new Error(`Failed to update visit: ${error.message}`);

  const { data: after } = await supabase.from("clinical_visits").select("*").eq("id", visitId).maybeSingle();
  const diff = after ? diffForAudit(before, after) : null;
  if (diff) {
    await logAuditEvent({
      userId: actingUserId,
      action: "clinical_visit.correct",
      entityType: "clinical_visit",
      entityId: visitId,
      oldValues: diff.oldValues,
      newValues: { ...diff.newValues, correction_reason: reason },
    });
  }
}
