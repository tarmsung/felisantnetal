"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import {
  createStaffUser,
  updateUserRole,
  updateUserStatus,
  resetUserPassword,
} from "@/lib/services/userService";
import { logAuditEvent } from "@/lib/services/auditService";
import {
  createUserSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  resetPasswordSchema,
  type CreateUserInput,
  type UpdateUserRoleInput,
  type UpdateUserStatusInput,
  type ResetPasswordInput,
} from "@/lib/validation/userSchemas";

export interface ActionResult {
  status: "success" | "error";
  message?: string;
}

export async function createUserAction(input: CreateUserInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const created = await createStaffUser({
      fullName: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: parsed.data.role,
      temporaryPassword: parsed.data.temporary_password,
    });

    await logAuditEvent({
      userId: admin.id,
      action: "user.create",
      entityType: "user",
      entityId: created.id,
      newValues: { full_name: created.full_name, email: created.email, role: created.role },
    });
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to create user." };
  }

  revalidatePath("/users");
  return { status: "success" };
}

export async function updateUserRoleAction(
  userId: string,
  input: UpdateUserRoleInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await updateUserRole(userId, parsed.data.role, admin.id);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to update role." };
  }

  revalidatePath("/users");
  return { status: "success" };
}

export async function updateUserStatusAction(
  userId: string,
  input: UpdateUserStatusInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = updateUserStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await updateUserStatus(userId, parsed.data.status, admin.id);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to update status." };
  }

  revalidatePath("/users");
  return { status: "success" };
}

export async function resetPasswordAction(
  userId: string,
  input: ResetPasswordInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await resetUserPassword(userId, parsed.data.new_password, admin.id);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to reset password." };
  }

  return { status: "success" };
}
