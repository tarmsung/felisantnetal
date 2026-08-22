"use server";

import { requireUser } from "@/lib/auth/session";
import { checkDuplicatePatients, registerPatient } from "@/lib/services/patientService";
import { patientOutputSchema, type PatientFormInput } from "@/lib/validation/patientSchemas";

export interface PatientDuplicateMatch {
  id: string;
  patient_number: string;
  full_name: string;
  phone: string | null;
  national_id: string | null;
  date_of_birth: string | null;
}

export type RegisterPatientActionResult =
  | { status: "duplicates"; matches: PatientDuplicateMatch[] }
  | { status: "error"; message: string }
  | { status: "success"; patientId: string };

/**
 * Called directly from the client form component (not bound as a
 * `<form action>`) so react-hook-form can own client-side validation
 * and structured field state; the server still re-validates before
 * touching the database — a client bypass can skip the UI, not the
 * rule. Re-validation uses patientOutputSchema, not patientFormSchema:
 * what arrives here is already-transformed data (a real `number` for
 * gravida, not the form's raw string), and patientFormSchema's fields
 * are built to validate/transform *from* raw strings — see that
 * schema's own comment for why re-running it here would be wrong.
 *
 * `skipDuplicateCheck` is how the UI's "Register anyway" button
 * resubmits after the nurse has seen the potential-duplicate warning
 * (spec section 5) and chosen to proceed.
 */
export async function registerPatientAction(
  input: PatientFormInput,
  skipDuplicateCheck: boolean,
): Promise<RegisterPatientActionResult> {
  const user = await requireUser();

  const parsed = patientOutputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (!skipDuplicateCheck) {
    const matches = await checkDuplicatePatients({
      full_name: parsed.data.full_name,
      national_id: parsed.data.national_id,
      phone: parsed.data.phone,
      date_of_birth: parsed.data.date_of_birth,
    });

    if (matches.length > 0) {
      return {
        status: "duplicates",
        matches: matches.map((match) => ({
          id: match.id,
          patient_number: match.patient_number,
          full_name: match.full_name,
          phone: match.phone,
          national_id: match.national_id,
          date_of_birth: match.date_of_birth,
        })),
      };
    }
  }

  try {
    // See patientOutputSchema's comment: same fields, TS just infers
    // optional-key vs required-key-with-undefined differently.
    const { patientId } = await registerPatient(
      parsed.data as unknown as PatientFormInput,
      user.id,
    );
    return { status: "success", patientId };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Failed to register patient.",
    };
  }
}
