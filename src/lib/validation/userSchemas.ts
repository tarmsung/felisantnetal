import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

/** Matches scripts/seed.ts's own minimum — kept in one place would be nicer, but that script deliberately can't import from lib/ (see its own comment on server-only). */
const password = z.string().min(8, "Password must be at least 8 characters.");

export const createUserSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required.").max(200),
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  phone: optionalText(32),
  role: z.enum(["administrator", "nurse"], { message: "Select a role." }),
  temporary_password: password,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(["administrator", "nurse"], { message: "Select a role." }),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "inactive"], { message: "Select a status." }),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const resetPasswordSchema = z.object({
  new_password: password,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
