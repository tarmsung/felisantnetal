import { z } from "zod";

/**
 * The review workflow only ever moves a flag forward — active -> reviewed
 * -> resolved (migration 0007's protect_risk_flag_history trigger blocks
 * changing anything else about a flag, and RLS never allows deleting one
 * at all). review_notes is optional at the schema layer since "reviewed,
 * nothing further to add" is a legitimate outcome, but the UI encourages
 * entering one.
 */
export const reviewRiskFlagSchema = z.object({
  status: z.enum(["reviewed", "resolved"]),
  review_notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
});

export type ReviewRiskFlagInput = z.infer<typeof reviewRiskFlagSchema>;
