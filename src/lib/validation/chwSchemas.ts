import { z } from "zod";

export const createChwSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required.").max(200),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  area: z.string().trim().max(200).optional().or(z.literal("")),
});

export type CreateChwInput = z.infer<typeof createChwSchema>;
