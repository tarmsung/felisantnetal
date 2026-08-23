import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (!Number.isNaN(v) && v >= min && v <= max), {
      message: `Enter a value between ${min} and ${max}.`,
    });

export const clinicSettingsSchema = z.object({
  clinic_name: z.string().trim().min(1, "Clinic name is required.").max(200),
  address: optionalText(500),
  phone: optionalText(32),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  logo_url: optionalText(500),
});

export type ClinicSettingsInput = z.infer<typeof clinicSettingsSchema>;
export type ClinicSettingsValues = z.input<typeof clinicSettingsSchema>;

/**
 * Gestational week bounds (1-45) are a sanity guard against a typo, not
 * a clinical claim about when a visit "should" happen — that judgement
 * stays entirely with whoever enters it, per spec section 7/11: this
 * system never invents or second-guesses a clinical guideline value.
 */
export const ancScheduleTemplateSchema = z.object({
  recommended_gestational_week: optionalNumber(1, 45),
  is_active: z.boolean(),
  notes: optionalText(2000),
});

export type AncScheduleTemplateInput = z.infer<typeof ancScheduleTemplateSchema>;
export type AncScheduleTemplateValues = z.input<typeof ancScheduleTemplateSchema>;

/** Bounds here are data-entry sanity, same reasoning as clinicalVisitSchemas' vitals bounds — not a clinical claim about what threshold is correct. */
export const clinicalRuleSchema = z.object({
  threshold_min: optionalNumber(-1000, 1000),
  threshold_max: optionalNumber(-1000, 1000),
  severity: z.enum(["low", "medium", "high", "critical"]),
  is_active: z.boolean(),
});

export type ClinicalRuleInput = z.infer<typeof clinicalRuleSchema>;
export type ClinicalRuleValues = z.input<typeof clinicalRuleSchema>;

export const notificationTemplateSchema = z.object({
  body_template: z.string().trim().min(1, "Message body is required.").max(1000),
  is_active: z.boolean(),
});

export type NotificationTemplateInput = z.infer<typeof notificationTemplateSchema>;
export type NotificationTemplateValues = z.input<typeof notificationTemplateSchema>;

export const notificationSettingsSchema = z.object({
  reminder_hours_before: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number of hours.")
    .transform((v) => Number(v))
    .refine((v) => v >= 1 && v <= 336, { message: "Enter between 1 and 336 hours (14 days)." }),
  retry_max_attempts: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number.")
    .transform((v) => Number(v))
    .refine((v) => v >= 0 && v <= 10, { message: "Enter between 0 and 10." }),
  retry_backoff_minutes: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number of minutes.")
    .transform((v) => Number(v))
    .refine((v) => v >= 1 && v <= 1440, { message: "Enter between 1 and 1440 minutes (24 hours)." }),
  whatsapp_provider: optionalText(100),
});

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
export type NotificationSettingsValues = z.input<typeof notificationSettingsSchema>;
