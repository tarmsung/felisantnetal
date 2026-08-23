import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent, diffForAudit } from "@/lib/services/auditService";
import type { ClinicSettingsRow } from "@/types/database";

/**
 * The clinic_settings singleton row (spec section 35) — a boolean
 * primary key defaulting to `true` guarantees exactly one row exists
 * (migration 0006's comment explains the trick). Any active staff
 * member can read it (the PDF module, Phase 7, needs the clinic
 * name/address on every generated document); only an administrator can
 * write it (RLS clinic_settings_write/update, migration 0009).
 */
export async function getClinicSettings(): Promise<ClinicSettingsRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("clinic_settings").select("*").eq("id", true).maybeSingle();
  return data ?? null;
}

export interface UpdateClinicSettingsInput {
  clinic_name: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  default_phone_country_code: string;
}

export async function updateClinicSettings(
  input: UpdateClinicSettingsInput,
  actingAdminId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("clinic_settings").select("*").eq("id", true).maybeSingle();

  const { error } = await supabase
    .from("clinic_settings")
    .update({
      clinic_name: input.clinic_name,
      address: input.address ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      logo_url: input.logo_url ?? null,
      default_phone_country_code: input.default_phone_country_code,
      updated_by: actingAdminId,
    })
    .eq("id", true);
  if (error) throw new Error(`Failed to update clinic settings: ${error.message}`);

  const { data: after } = await supabase.from("clinic_settings").select("*").eq("id", true).maybeSingle();
  const diff = before && after ? diffForAudit(before, after) : null;
  if (diff) {
    await logAuditEvent({
      userId: actingAdminId,
      action: "clinic_settings.update",
      entityType: "clinic_settings",
      entityId: "singleton",
      ...diff,
    });
  }
}
