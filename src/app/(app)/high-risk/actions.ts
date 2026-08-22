"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { reviewRiskFlag, listRiskFlagsForPatient } from "@/lib/services/riskService";
import { reviewRiskFlagSchema, type ReviewRiskFlagInput } from "@/lib/validation/riskFlagSchemas";
import type { RiskFlagRow } from "@/types/database";

export interface ActionResult {
  status: "success" | "error";
  message?: string;
}

export async function reviewRiskFlagAction(
  flagId: string,
  patientId: string,
  input: ReviewRiskFlagInput,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = reviewRiskFlagSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await reviewRiskFlag(flagId, parsed.data.status, parsed.data.review_notes, user.id);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to update risk flag." };
  }

  // patients.risk_status is kept in sync by the sync_patient_risk_status
  // trigger (migration 0007) the moment the update above lands, so the
  // patient list/dashboard/summary cards all need revalidating too, not
  // just the high-risk page itself.
  revalidatePath("/high-risk");
  revalidatePath("/dashboard");
  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  return { status: "success" };
}

/** Backs the High Risk page's per-patient detail sheet. */
export async function listRiskFlagsForPatientAction(patientId: string): Promise<RiskFlagRow[]> {
  await requireUser();
  return listRiskFlagsForPatient(patientId);
}
