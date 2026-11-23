import { z } from "zod";
import { nameField, optionalPhoneField } from "./rules";

export const createChwSchema = z.object({
  full_name: nameField("Full name"),
  phone: optionalPhoneField(),
  area: z.string().trim().max(200).optional().or(z.literal("")),
});

export type CreateChwInput = z.infer<typeof createChwSchema>;
