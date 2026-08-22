"use server";

import { requireUser } from "@/lib/auth/session";
import { updatePatient } from "@/lib/services/patientService";
import { patientOutputSchema, type PatientFormInput } from "@/lib/validation/patientSchemas";

export type UpdatePatientActionResult =
  | { status: "success" }
  | { status: "error"; message: string };

export async function updatePatientAction(
  patientId: string,
  pregnancyId: string | null,
  input: PatientFormInput,
): Promise<UpdatePatientActionResult> {
  const user = await requireUser();

  // See patientOutputSchema's comment (patientSchemas.ts) — this
  // receives already-transformed data, not raw form strings.
  const parsed = patientOutputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    // The edit form always submits every field (it's a full form, not a
    // selective patch), so `undefined` here means "the nurse left this
    // blank" and must become `null` in the database — unlike the RPC
    // path in registerPatient(), a plain object with `undefined` values
    // would have those keys silently dropped by JSON.stringify and the
    // existing value would stick around unchanged, which is wrong here.
    await updatePatient(
      patientId,
      pregnancyId,
      {
        patient: {
          full_name: parsed.data.full_name,
          national_id: parsed.data.national_id ?? null,
          date_of_birth: parsed.data.date_of_birth ?? null,
          phone: parsed.data.phone ?? null,
          alternative_phone: parsed.data.alternative_phone ?? null,
          address: parsed.data.address ?? null,
          emergency_contact_name: parsed.data.emergency_contact_name ?? null,
          emergency_contact_phone: parsed.data.emergency_contact_phone ?? null,
          community_health_worker_id: parsed.data.community_health_worker_id,
          notes: parsed.data.notes ?? null,
        },
        pregnancy: {
          gravida: parsed.data.gravida ?? null,
          para: parsed.data.para ?? null,
          lmp: parsed.data.lmp ?? null,
          edd: parsed.data.edd,
          gestational_information: parsed.data.gestational_information ?? null,
        },
      },
      user.id,
    );
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Failed to update patient.",
    };
  }

  return { status: "success" };
}
