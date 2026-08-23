import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent, diffForAudit } from "@/lib/services/auditService";
import type { NotificationSettingsRow, NotificationTemplateRow } from "@/types/database";

/**
 * Phase 5 (spec section 43) will add the actual WhatsApp-sending
 * facade here (a swappable provider interface, per ARCHITECTURE.md's
 * "Notifications" section) and the reminder scheduler that uses it.
 * What's built now, ahead of that, is purely the *configuration* side
 * spec section 35 also asks for — the message template text and the
 * timing/retry settings — since an administrator being able to see and
 * adjust those doesn't depend on anything actually being sent yet.
 */

export async function listNotificationTemplates(): Promise<NotificationTemplateRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("notification_templates").select("*").order("template_key");
  if (error) throw new Error(`Failed to load notification templates: ${error.message}`);
  return data ?? [];
}

export interface UpdateNotificationTemplateInput {
  bodyTemplate: string;
  isActive: boolean;
}

export async function updateNotificationTemplate(
  id: string,
  input: UpdateNotificationTemplateInput,
  actingAdminId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: before, error: fetchError } = await supabase
    .from("notification_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !before) throw new Error(`Template not found: ${fetchError?.message ?? "unknown error"}`);

  const { error } = await supabase
    .from("notification_templates")
    .update({ body_template: input.bodyTemplate, is_active: input.isActive, updated_by: actingAdminId })
    .eq("id", id);
  if (error) throw new Error(`Failed to update template: ${error.message}`);

  const { data: after } = await supabase.from("notification_templates").select("*").eq("id", id).maybeSingle();
  const diff = after ? diffForAudit(before, after) : null;
  if (diff) {
    await logAuditEvent({
      userId: actingAdminId,
      action: "notification_template.update",
      entityType: "notification_template",
      entityId: id,
      ...diff,
    });
  }
}

export async function getNotificationSettings(): Promise<NotificationSettingsRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("notification_settings").select("*").eq("id", true).maybeSingle();
  return data ?? null;
}

export interface UpdateNotificationSettingsInput {
  reminderHoursBefore: number;
  retryMaxAttempts: number;
  retryBackoffMinutes: number;
  whatsappProvider?: string;
}

export async function updateNotificationSettings(
  input: UpdateNotificationSettingsInput,
  actingAdminId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("notification_settings").select("*").eq("id", true).maybeSingle();

  const { error } = await supabase
    .from("notification_settings")
    .update({
      reminder_hours_before: input.reminderHoursBefore,
      retry_max_attempts: input.retryMaxAttempts,
      retry_backoff_minutes: input.retryBackoffMinutes,
      whatsapp_provider: input.whatsappProvider ?? null,
      updated_by: actingAdminId,
    })
    .eq("id", true);
  if (error) throw new Error(`Failed to update notification settings: ${error.message}`);

  const { data: after } = await supabase.from("notification_settings").select("*").eq("id", true).maybeSingle();
  const diff = before && after ? diffForAudit(before, after) : null;
  if (diff) {
    await logAuditEvent({
      userId: actingAdminId,
      action: "notification_settings.update",
      entityType: "notification_settings",
      entityId: "singleton",
      ...diff,
    });
  }
}
