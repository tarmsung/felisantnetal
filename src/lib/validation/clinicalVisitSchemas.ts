import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

/**
 * These bounds are data-entry sanity guards against typos (a misplaced
 * decimal point, an extra digit) — not clinical thresholds. The actual
 * judgement of what's clinically concerning lives entirely in the
 * administrator-configured clinical_rules table (see riskService.ts /
 * spec section 11). Bounds here are kept deliberately generous so a
 * genuine outlier reading is never blocked from being recorded.
 */
const optionalDecimal = (min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (!Number.isNaN(v) && v >= min && v <= max), {
      message: `Enter a value between ${min} and ${max}.`,
    });

const visitNumber = z
  .string()
  .trim()
  .regex(/^\d+$/, "Enter the visit number.")
  .transform((v) => Number(v))
  .refine((v) => v >= 1 && v <= 30, { message: "Enter a visit number between 1 and 30." });

const optionalUuid = z
  .string()
  .trim()
  .uuid()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

export const recordVisitSchema = z.object({
  patient_id: z.string().uuid(),
  pregnancy_id: z.string().uuid(),
  appointment_id: optionalUuid,
  visit_number: visitNumber,
  visit_date: isoDate,
  weight_kg: optionalDecimal(20, 200),
  blood_pressure_systolic: optionalDecimal(40, 260),
  blood_pressure_diastolic: optionalDecimal(20, 180),
  fundal_height_cm: optionalDecimal(0, 60),
  fetal_heart_rate: optionalDecimal(50, 220),
  hb_g_dl: optionalDecimal(2, 20),
  clinical_notes: optionalText(4000),
});

/** Parsed/transformed shape — what clinicalVisitService receives. */
export type RecordVisitInput = z.infer<typeof recordVisitSchema>;
/** Raw form-string shape the client actually sends. */
export type RecordVisitValues = z.input<typeof recordVisitSchema>;

/**
 * Admin-only correction (spec section 10: "Do not silently alter
 * entered clinical values" — a nurse's own typo fix goes through an
 * admin-reviewed correction, not a silent edit; enforced independently
 * at the RLS layer too, migration 0009's clinical_visits_update_admin).
 * A reason is mandatory so the audit trail always explains *why* a
 * historical clinical value changed, not just what it changed to.
 */
export const updateVisitSchema = z.object({
  weight_kg: optionalDecimal(20, 200),
  blood_pressure_systolic: optionalDecimal(40, 260),
  blood_pressure_diastolic: optionalDecimal(20, 180),
  fundal_height_cm: optionalDecimal(0, 60),
  fetal_heart_rate: optionalDecimal(50, 220),
  hb_g_dl: optionalDecimal(2, 20),
  clinical_notes: optionalText(4000),
  correction_reason: z.string().trim().min(1, "Explain why this record is being corrected.").max(500),
});

export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
export type UpdateVisitValues = z.input<typeof updateVisitSchema>;
