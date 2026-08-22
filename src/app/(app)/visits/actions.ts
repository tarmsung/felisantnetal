"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/auth/session";
import {
  recordVisit,
  updateVisitAdmin,
  getRecordedVisitNumbers,
  type RecordVisitResult,
} from "@/lib/services/clinicalVisitService";
import { listRiskFlagsForVisit } from "@/lib/services/riskService";
import { suggestNextVisitNumber, type NextVisitNumberSuggestion } from "@/lib/services/ancService";
import { searchPatients, getLatestPregnancy } from "@/lib/services/patientService";
import type { RiskFlagRow } from "@/types/database";
import {
  recordVisitSchema,
  updateVisitSchema,
  type RecordVisitValues,
  type UpdateVisitValues,
} from "@/lib/validation/clinicalVisitSchemas";

export interface ActionResult {
  status: "success" | "error";
  message?: string;
}

export interface RecordVisitActionResult extends ActionResult {
  riskFlagCount?: number;
  riskEvaluationError?: string;
}

/** Every mutation below revalidates the surfaces that show visit/appointment/risk data. */
function revalidateClinicalSurfaces(patientId?: string) {
  revalidatePath("/visits");
  revalidatePath("/high-risk");
  revalidatePath("/appointments");
  revalidatePath("/missed-visits");
  revalidatePath("/dashboard");
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

export async function recordVisitAction(
  input: RecordVisitValues,
): Promise<RecordVisitActionResult> {
  const user = await requireUser();
  const parsed = recordVisitSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let result: RecordVisitResult;
  try {
    result = await recordVisit(
      {
        patientId: parsed.data.patient_id,
        pregnancyId: parsed.data.pregnancy_id,
        appointmentId: parsed.data.appointment_id,
        visitNumber: parsed.data.visit_number,
        visitDate: parsed.data.visit_date,
        weightKg: parsed.data.weight_kg,
        bloodPressureSystolic: parsed.data.blood_pressure_systolic,
        bloodPressureDiastolic: parsed.data.blood_pressure_diastolic,
        fundalHeightCm: parsed.data.fundal_height_cm,
        fetalHeartRate: parsed.data.fetal_heart_rate,
        hbGDl: parsed.data.hb_g_dl,
        clinicalNotes: parsed.data.clinical_notes,
      },
      user.id,
    );
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to record visit." };
  }

  revalidateClinicalSurfaces(parsed.data.patient_id);
  return {
    status: "success",
    riskFlagCount: result.riskFlags.length,
    riskEvaluationError: result.riskEvaluationError,
  };
}

export async function updateVisitAdminAction(
  visitId: string,
  patientId: string,
  input: UpdateVisitValues,
): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = updateVisitSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await updateVisitAdmin(
      visitId,
      {
        weightKg: parsed.data.weight_kg,
        bloodPressureSystolic: parsed.data.blood_pressure_systolic,
        bloodPressureDiastolic: parsed.data.blood_pressure_diastolic,
        fundalHeightCm: parsed.data.fundal_height_cm,
        fetalHeartRate: parsed.data.fetal_heart_rate,
        hbGDl: parsed.data.hb_g_dl,
        clinicalNotes: parsed.data.clinical_notes,
      },
      parsed.data.correction_reason,
      user.id,
    );
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to update visit." };
  }

  revalidateClinicalSurfaces(patientId);
  return { status: "success" };
}

/** Prefills the "Record visit" form's visit number, per the ANC scheduling engine's config (ancService). */
export async function getNextVisitNumberAction(
  pregnancyId: string,
): Promise<NextVisitNumberSuggestion> {
  await requireUser();
  const recorded = await getRecordedVisitNumbers(pregnancyId);
  return suggestNextVisitNumber(recorded);
}

export interface PatientPickerResult {
  id: string;
  fullName: string;
  patientNumber: string;
  pregnancyId: string | null;
}

/** Backs the patient search inside "Record visit" when opened without a patient already in context. */
export async function searchPatientsForVisitAction(query: string): Promise<PatientPickerResult[]> {
  await requireUser();
  if (!query.trim()) return [];

  const { rows } = await searchPatients({ query, page: 1 });
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      fullName: row.full_name,
      patientNumber: row.patient_number,
      pregnancyId: (await getLatestPregnancy(row.id))?.id ?? null,
    })),
  );
}

/** Backs the visit detail sheet's "why was this flagged" section. */
export async function getRiskFlagsForVisitAction(visitId: string): Promise<RiskFlagRow[]> {
  await requireUser();
  return listRiskFlagsForVisit(visitId);
}
