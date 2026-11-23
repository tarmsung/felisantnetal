import { z } from "zod";
import {
  checkPatientDates,
  nameField,
  optionalNameField,
  optionalNationalIdField,
  optionalPhoneField,
} from "./rules";

/**
 * What's actually required to submit vs. what the spec lists as fields
 * the form must merely *capture* are two different things (see spec
 * section 4's own caution against over-assuming required fields).
 * Full name and EDD are non-negotiable — you can't identify a patient
 * or schedule ANC without them. Community health worker is required
 * because it's asked for alongside identity fields in spec section 5
 * and every later phase (missed-visit follow-up, field worker
 * dashboards) depends on it being set at registration, not backfilled.
 * National ID and phone are present on the form (spec section 5) but
 * optional — plenty of real patients, especially in this setting,
 * won't have a national ID on hand at registration, and hard-blocking
 * on it would contradict "designed for real clinic use" (spec section 1).
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const optionalInt = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= min && v <= max), {
      message: `Enter a whole number between ${min} and ${max}.`,
    });

/**
 * Cross-field rules shared by the form schema (browser) and the output
 * schema (server) — a rule only the form enforced could be skipped by
 * calling the server action directly. Dates are checked against "today"
 * in the clinic's timezone (rules.ts), not the machine's.
 */
function patientRefiner(mode: "register" | "edit") {
  return (
    d: { date_of_birth?: string; lmp?: string; edd?: string; gravida?: number; para?: number },
    ctx: z.RefinementCtx,
  ) => {
    for (const issue of checkPatientDates(d, undefined, mode)) {
      ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
    }
    if (d.gravida !== undefined && d.para !== undefined && d.para > d.gravida) {
      ctx.addIssue({
        code: "custom",
        path: ["para"],
        message: "Para (previous births) can't be more than gravida (total pregnancies).",
      });
    }
  };
}

/** Field-level rules only — kept separate because Zod can't `.pick()` a schema that already carries a cross-field refinement (see duplicateCheckSchema). */
const patientBaseSchema = z.object({
  full_name: nameField("Full name"),
  national_id: optionalNationalIdField(),
  date_of_birth: isoDate,
  phone: optionalPhoneField(),
  alternative_phone: optionalPhoneField(),
  address: optionalText(500),
  emergency_contact_name: optionalNameField(200),
  emergency_contact_phone: optionalPhoneField(),
  community_health_worker_id: z
    .string()
    .uuid("Select a community health worker."),
  notes: optionalText(2000),
  gravida: optionalInt(30, 1),
  para: optionalInt(30),
  lmp: isoDate,
  edd: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Estimated date of delivery is required."),
  gestational_information: optionalText(2000),
});

/** Registering a new patient/pregnancy — every rule, including "not too long ago" (rules.ts checkPatientDates). */
export const patientFormSchema = patientBaseSchema.superRefine(patientRefiner("register"));
/** Editing an existing patient — same rules minus the recency ones, so a past-due mother's record stays editable. */
export const patientEditFormSchema = patientBaseSchema.superRefine(patientRefiner("edit"));

/** Parsed/transformed shape — what services and server actions receive. */
export type PatientFormInput = z.infer<typeof patientFormSchema>;
/** Raw shape react-hook-form works with (before zod's transforms run). */
export type PatientFormValues = z.input<typeof patientFormSchema>;

/**
 * Server actions receive an already-transformed PatientFormInput
 * object (numbers as numbers, blanks as undefined) — not raw form
 * strings — because the client calls the server action directly with
 * structured data rather than posting FormData (see
 * app/(app)/patients/new/actions.ts for why). Re-validating with
 * patientFormSchema itself would be wrong here: its `gravida`/`para`
 * fields start from `z.string()` and reject an actual number outright.
 * This schema validates the OUTPUT shape's own rules directly, so the
 * server never blindly trusts the client without also never rejecting
 * legitimately-already-parsed data.
 *
 * Structurally this matches PatientFormInput field-for-field, but isn't
 * declared `satisfies z.ZodType<PatientFormInput>` — zod's inferred type
 * for a plain `.optional()` field is an optional key (`field?:`), while
 * patientFormSchema's transform-chained fields infer as a required key
 * typed `T | undefined`. Both mean the same thing at runtime; TS treats
 * them as distinct enough that the two don't unify under `satisfies`.
 * Callers that hand `parsed.data` to a PatientFormInput-typed parameter
 * cast it, documented at each call site.
 */
const patientOutputBase = z
  .object({
  full_name: nameField("Full name"),
  national_id: optionalNationalIdField(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  phone: optionalPhoneField(),
  alternative_phone: optionalPhoneField(),
  address: z.string().trim().max(500).optional(),
  emergency_contact_name: optionalNameField(200),
  emergency_contact_phone: optionalPhoneField(),
  community_health_worker_id: z.string().uuid("Select a community health worker."),
  notes: z.string().trim().max(2000).optional(),
  gravida: z.number().int().min(1).max(30).optional(),
  para: z.number().int().min(0).max(30).optional(),
  lmp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  edd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Estimated date of delivery is required."),
  gestational_information: z.string().trim().max(2000).optional(),
  });

export const patientOutputSchema = patientOutputBase.superRefine(patientRefiner("register"));
export const patientEditOutputSchema = patientOutputBase.superRefine(patientRefiner("edit"));

export const duplicateCheckSchema = patientBaseSchema.pick({
  full_name: true,
  national_id: true,
  phone: true,
  date_of_birth: true,
});

export type DuplicateCheckInput = z.infer<typeof duplicateCheckSchema>;
