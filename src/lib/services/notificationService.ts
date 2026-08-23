import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logAuditEvent, diffForAudit } from "@/lib/services/auditService";
import { getNotificationProvider, renderTemplate, formatPhoneForWhatsapp } from "@/lib/services/notifications";
import { formatClinicDateTime } from "@/lib/dates";
import type { Database, NotificationSettingsRow, NotificationTemplateRow } from "@/types/database";

/**
 * Phase 1-4/6-9 built the *configuration* side of this (spec section
 * 35) — message template text and timing/retry settings — ahead of the
 * actual WhatsApp-sending facade, since an administrator being able to
 * see and adjust those doesn't depend on anything actually being sent.
 * Phase 5 adds that facade (lib/services/notifications/ — a swappable
 * provider interface per ARCHITECTURE.md's "Notifications" section) and
 * the two functions below that use it.
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

async function countPriorAttempts(supabase: SupabaseClient<Database>, appointmentId: string): Promise<number> {
  const { count } = await supabase
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("appointment_id", appointmentId);
  return count ?? 0;
}

export interface SendReminderResult {
  success: boolean;
  error?: string;
}

async function recordFailedAttempt(
  supabase: SupabaseClient<Database>,
  appointmentId: string,
  patientId: string,
  scheduledForIso: string,
  recipientSnapshot: string,
  errorMessage: string,
): Promise<SendReminderResult> {
  const { error: insertError } = await supabase.from("reminders").insert({
    appointment_id: appointmentId,
    patient_id: patientId,
    channel: "whatsapp",
    recipient: recipientSnapshot,
    scheduled_for: scheduledForIso,
    delivery_status: "failed",
    error_message: errorMessage,
    attempt_count: (await countPriorAttempts(supabase, appointmentId)) + 1,
  });
  if (insertError) console.error("[notificationService] failed to record reminder attempt:", insertError.message);

  await supabase.from("appointments").update({ reminder_status: "failed" }).eq("id", appointmentId);
  return { success: false, error: errorMessage };
}

/**
 * Sends (or records why it couldn't send) one appointment's reminder.
 * Shared by two very differently-privileged callers, which is why the
 * client is a parameter rather than constructed inside this function:
 *   - the manual "Send reminder now" action — a real staff member is
 *     acting, so the ordinary RLS-scoped client is correct and
 *     sufficient (reminders_insert's RLS policy already allows any
 *     active staff member to do this).
 *   - the cron sweep (runReminderSweep, below) — no staff session
 *     exists at all, so it must use the service-role client; migration
 *     0009's reminders RLS policy comment says this explicitly ("The
 *     cron job writes as service_role, which bypasses RLS entirely").
 *
 * `actingUserId` is null for the cron path, attributed the same way
 * appointmentService.sweepMissedAppointments attributes its own
 * system-initiated audit entries.
 */
export async function sendReminderForAppointment(
  supabase: SupabaseClient<Database>,
  appointmentId: string,
  actingUserId: string | null,
): Promise<SendReminderResult> {
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select("id, patient_id, scheduled_date")
    .eq("id", appointmentId)
    .maybeSingle();
  if (apptError || !appointment) {
    return { success: false, error: `Appointment not found: ${apptError?.message ?? "unknown error"}` };
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("full_name, phone")
    .eq("id", appointment.patient_id)
    .maybeSingle();
  if (!patient) {
    return { success: false, error: "Patient record not found." };
  }

  if (!patient.phone) {
    return recordFailedAttempt(
      supabase,
      appointment.id,
      appointment.patient_id,
      appointment.scheduled_date,
      "",
      "Patient has no phone number on file.",
    );
  }

  const [{ data: template }, { data: settings }, { data: clinicSettings }] = await Promise.all([
    supabase
      .from("notification_templates")
      .select("*")
      .eq("channel", "whatsapp")
      .eq("template_key", "appointment_reminder")
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("notification_settings").select("*").eq("id", true).maybeSingle(),
    supabase.from("clinic_settings").select("default_phone_country_code").eq("id", true).maybeSingle(),
  ]);

  if (!template) {
    return recordFailedAttempt(
      supabase,
      appointment.id,
      appointment.patient_id,
      appointment.scheduled_date,
      patient.phone,
      "No active WhatsApp reminder template is configured (Settings → Notifications).",
    );
  }

  const jid = formatPhoneForWhatsapp(patient.phone, clinicSettings?.default_phone_country_code ?? "263");
  if (!jid) {
    return recordFailedAttempt(
      supabase,
      appointment.id,
      appointment.patient_id,
      appointment.scheduled_date,
      patient.phone,
      "Could not turn this patient's phone number into a usable WhatsApp number.",
    );
  }

  const body = renderTemplate(template.body_template, {
    patient_name: patient.full_name,
    appointment_date: formatClinicDateTime(appointment.scheduled_date),
  });

  const provider = getNotificationProvider(settings?.whatsapp_provider);
  const result = await provider.send(jid, body);
  const nowIso = new Date().toISOString();

  const { error: insertError } = await supabase.from("reminders").insert({
    appointment_id: appointment.id,
    patient_id: appointment.patient_id,
    channel: "whatsapp",
    recipient: jid,
    scheduled_for: appointment.scheduled_date,
    sent_at: result.success ? nowIso : null,
    delivery_status: result.success ? "sent" : "failed",
    provider_message_id: result.providerMessageId ?? null,
    error_message: result.error ?? null,
    attempt_count: (await countPriorAttempts(supabase, appointment.id)) + 1,
  });
  if (insertError) console.error("[notificationService] failed to record reminder attempt:", insertError.message);

  await supabase
    .from("appointments")
    .update({
      reminder_status: result.success ? "sent" : "failed",
      reminder_sent_at: result.success ? nowIso : null,
    })
    .eq("id", appointment.id);

  await logAuditEvent({
    userId: actingUserId,
    action: result.success ? "reminder.sent" : "reminder.failed",
    entityType: "appointment",
    entityId: appointment.id,
    newValues: { delivery_status: result.success ? "sent" : "failed", error: result.error ?? null },
  });

  return { success: result.success, error: result.error };
}

export interface ReminderSweepResult {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * The real scheduled job spec section 27 asks for — see the "interim
 * stand-in... since cron infrastructure this phase doesn't build yet"
 * comment on appointmentService.sweepMissedAppointments, written back
 * in Phase 3 specifically anticipating this. Meant to be called from
 * src/app/api/cron/reminders/route.ts on an external schedule (system
 * cron, a hosting platform's scheduled trigger, etc. — this app has no
 * built-in scheduler of its own).
 *
 * Two passes over `appointments` (not `reminders` — reminder_status on
 * the appointment itself is the authoritative "does this still need
 * one" signal, kept in sync by every function above and by
 * appointmentService's cancel/complete/mark-missed/reschedule paths):
 *   1. Newly due: status still 'scheduled', reminder_status still
 *      'pending', scheduled within the configured reminder window.
 *   2. Retries: reminder_status 'failed', still 'scheduled' and still
 *      in the future (no point retrying for a visit that already
 *      passed), under retry_max_attempts, and past retry_backoff_minutes
 *      since the last attempt.
 */
export async function runReminderSweep(): Promise<ReminderSweepResult> {
  const supabase = createSupabaseServiceClient();
  const { data: settings } = await supabase.from("notification_settings").select("*").eq("id", true).maybeSingle();
  const hoursBefore = settings?.reminder_hours_before ?? 48;
  const maxAttempts = settings?.retry_max_attempts ?? 3;
  const backoffMinutes = settings?.retry_backoff_minutes ?? 30;

  const now = new Date();
  const nowIso = now.toISOString();
  const windowEndIso = new Date(now.getTime() + hoursBefore * 3_600_000).toISOString();
  const backoffCutoffIso = new Date(now.getTime() - backoffMinutes * 60_000).toISOString();

  const result: ReminderSweepResult = { sent: 0, failed: 0, skipped: 0 };

  const { data: due } = await supabase
    .from("appointments")
    .select("id")
    .eq("status", "scheduled")
    .eq("reminder_status", "pending")
    .gte("scheduled_date", nowIso)
    .lte("scheduled_date", windowEndIso);

  for (const row of due ?? []) {
    const outcome = await sendReminderForAppointment(supabase, row.id, null);
    if (outcome.success) result.sent++;
    else result.failed++;
  }

  const { data: failedCandidates } = await supabase
    .from("appointments")
    .select("id")
    .eq("status", "scheduled")
    .eq("reminder_status", "failed")
    .gte("scheduled_date", nowIso);

  for (const row of failedCandidates ?? []) {
    const attempts = await countPriorAttempts(supabase, row.id);
    if (attempts >= maxAttempts) {
      result.skipped++;
      continue;
    }

    const { data: lastAttempt } = await supabase
      .from("reminders")
      .select("created_at")
      .eq("appointment_id", row.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastAttempt && lastAttempt.created_at > backoffCutoffIso) {
      result.skipped++;
      continue;
    }

    const outcome = await sendReminderForAppointment(supabase, row.id, null);
    if (outcome.success) result.sent++;
    else result.failed++;
  }

  return result;
}
