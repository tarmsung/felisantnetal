"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  completeAppointment,
  markAppointmentMissed,
  addAppointmentNote,
  getUsedVisitNumbers,
} from "@/lib/services/appointmentService";
import { clinicLocalDateTimeToIso } from "@/lib/dates";
import { searchPatients, getLatestPregnancy } from "@/lib/services/patientService";
import { suggestNextVisit, type NextVisitSuggestion } from "@/lib/services/ancService";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  cancelAppointmentSchema,
  addAppointmentNoteSchema,
  type CreateAppointmentValues,
  type RescheduleAppointmentInput,
  type CancelAppointmentInput,
  type AddAppointmentNoteInput,
} from "@/lib/validation/appointmentSchemas";

export interface ActionResult {
  status: "success" | "error";
  message?: string;
}

/** Every mutation below revalidates the three surfaces that show appointment data. */
function revalidateAppointmentSurfaces(patientId?: string) {
  revalidatePath("/appointments");
  revalidatePath("/missed-visits");
  revalidatePath("/dashboard");
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

export async function createAppointmentAction(
  input: CreateAppointmentValues,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const scheduledDateIso = clinicLocalDateTimeToIso(parsed.data.scheduled_date_local);
  if (!scheduledDateIso) {
    return { status: "error", message: "Pick a valid date and time." };
  }

  try {
    await createAppointment(
      {
        patientId: parsed.data.patient_id,
        pregnancyId: parsed.data.pregnancy_id,
        visitNumber: parsed.data.visit_number,
        appointmentType: parsed.data.appointment_type,
        scheduledDateIso,
        notes: parsed.data.notes,
      },
      user.id,
    );
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to create appointment." };
  }

  revalidateAppointmentSurfaces(parsed.data.patient_id);
  return { status: "success" };
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  patientId: string,
  input: RescheduleAppointmentInput,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = rescheduleAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const newScheduledDateIso = clinicLocalDateTimeToIso(parsed.data.new_scheduled_date_local);
  if (!newScheduledDateIso) {
    return { status: "error", message: "Pick a valid date and time." };
  }

  try {
    await rescheduleAppointment(appointmentId, newScheduledDateIso, parsed.data.reason, user.id);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to reschedule." };
  }

  revalidateAppointmentSurfaces(patientId);
  return { status: "success" };
}

export async function cancelAppointmentAction(
  appointmentId: string,
  patientId: string,
  input: CancelAppointmentInput,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = cancelAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await cancelAppointment(appointmentId, parsed.data.reason, user.id);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to cancel." };
  }

  revalidateAppointmentSurfaces(patientId);
  return { status: "success" };
}

export async function completeAppointmentAction(
  appointmentId: string,
  patientId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await completeAppointment(appointmentId, user.id);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to complete." };
  }
  revalidateAppointmentSurfaces(patientId);
  return { status: "success" };
}

export async function markAppointmentMissedAction(
  appointmentId: string,
  patientId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await markAppointmentMissed(appointmentId, user.id);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to update." };
  }
  revalidateAppointmentSurfaces(patientId);
  return { status: "success" };
}

/** Prefills the "Add appointment" dialog's visit number / suggested date, per the ANC scheduling engine (ancService). */
export async function getNextVisitSuggestionAction(
  pregnancyId: string,
): Promise<NextVisitSuggestion> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: pregnancy } = await supabase
    .from("pregnancies")
    .select("lmp")
    .eq("id", pregnancyId)
    .single();

  const usedVisitNumbers = await getUsedVisitNumbers(pregnancyId);
  return suggestNextVisit({ lmp: pregnancy?.lmp ?? null }, usedVisitNumbers);
}

export interface PatientPickerResult {
  id: string;
  fullName: string;
  patientNumber: string;
  pregnancyId: string | null;
}

/**
 * Backs the patient search inside "Add appointment" when opened from the
 * calendar (no patient context yet, unlike the same dialog opened from
 * a patient's own profile). Bounded to whatever searchPatients already
 * paginates to (20), so the N+1 pregnancy lookup below stays cheap.
 */
export async function searchPatientsForAppointmentAction(
  query: string,
): Promise<PatientPickerResult[]> {
  await requireUser();
  if (!query.trim()) return [];

  const { rows } = await searchPatients({ query, page: 1 });
  const withPregnancy = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      fullName: row.full_name,
      patientNumber: row.patient_number,
      pregnancyId: (await getLatestPregnancy(row.id))?.id ?? null,
    })),
  );
  return withPregnancy;
}

export async function addAppointmentNoteAction(
  appointmentId: string,
  patientId: string,
  input: AddAppointmentNoteInput,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = addAppointmentNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await addAppointmentNote(appointmentId, parsed.data.note, user.id, user.full_name);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to add note." };
  }

  revalidateAppointmentSurfaces(patientId);
  return { status: "success" };
}
