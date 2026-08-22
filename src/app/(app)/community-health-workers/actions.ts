"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createCommunityHealthWorker } from "@/lib/services/chwService";
import { logAuditEvent } from "@/lib/services/auditService";
import { createChwSchema } from "@/lib/validation/chwSchemas";

export interface CreateChwActionState {
  error?: string;
  success?: boolean;
}

export async function createChwAction(
  _prevState: CreateChwActionState,
  formData: FormData,
): Promise<CreateChwActionState> {
  // Belt-and-suspenders: RLS (chw_insert_admin) would reject this anyway,
  // but failing fast here gives a clean error instead of a raw
  // Postgres/PostgREST permission-denied message.
  const admin = await requireAdmin();

  const parsed = createChwSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    area: formData.get("area"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const chw = await createCommunityHealthWorker({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || undefined,
      area: parsed.data.area || undefined,
    });

    await logAuditEvent({
      userId: admin.id,
      action: "community_health_worker.create",
      entityType: "community_health_worker",
      entityId: chw.id,
      newValues: { full_name: chw.full_name, area: chw.area },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save." };
  }

  revalidatePath("/community-health-workers");
  return { success: true };
}
