"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { updateClinicSettings } from "@/lib/services/settingsService";
import { updateAncScheduleTemplate } from "@/lib/services/ancService";
import { updateClinicalRule } from "@/lib/services/riskService";
import {
  updateNotificationTemplate,
  updateNotificationSettings,
} from "@/lib/services/notificationService";
import {
  clinicSettingsSchema,
  ancScheduleTemplateSchema,
  clinicalRuleSchema,
  notificationTemplateSchema,
  notificationSettingsSchema,
  type ClinicSettingsValues,
  type AncScheduleTemplateValues,
  type ClinicalRuleValues,
  type NotificationTemplateValues,
  type NotificationSettingsValues,
} from "@/lib/validation/settingsSchemas";

export interface ActionResult {
  status: "success" | "error";
  message?: string;
}

function revalidateSettings() {
  revalidatePath("/settings");
  // Every page that reads these config tables should reflect a change immediately.
  revalidatePath("/appointments");
  revalidatePath("/visits");
  revalidatePath("/high-risk");
  revalidatePath("/patients/[id]", "page");
}

export async function updateClinicSettingsAction(input: ClinicSettingsValues): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = clinicSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await updateClinicSettings(parsed.data, admin.id);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to save." };
  }

  revalidateSettings();
  return { status: "success" };
}

export async function updateAncScheduleTemplateAction(
  id: string,
  input: AncScheduleTemplateValues,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = ancScheduleTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await updateAncScheduleTemplate(
      id,
      {
        recommendedGestationalWeek: parsed.data.recommended_gestational_week,
        isActive: parsed.data.is_active,
        notes: parsed.data.notes,
      },
      admin.id,
    );
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to save." };
  }

  revalidateSettings();
  return { status: "success" };
}

export async function updateClinicalRuleAction(id: string, input: ClinicalRuleValues): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = clinicalRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await updateClinicalRule(
      id,
      {
        thresholdMin: parsed.data.threshold_min,
        thresholdMax: parsed.data.threshold_max,
        severity: parsed.data.severity,
        isActive: parsed.data.is_active,
      },
      admin.id,
    );
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to save." };
  }

  revalidateSettings();
  return { status: "success" };
}

export async function updateNotificationTemplateAction(
  id: string,
  input: NotificationTemplateValues,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = notificationTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await updateNotificationTemplate(
      id,
      { bodyTemplate: parsed.data.body_template, isActive: parsed.data.is_active },
      admin.id,
    );
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to save." };
  }

  revalidateSettings();
  return { status: "success" };
}

export async function updateNotificationSettingsAction(
  input: NotificationSettingsValues,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = notificationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await updateNotificationSettings(
      {
        reminderHoursBefore: parsed.data.reminder_hours_before,
        retryMaxAttempts: parsed.data.retry_max_attempts,
        retryBackoffMinutes: parsed.data.retry_backoff_minutes,
        whatsappProvider: parsed.data.whatsapp_provider,
      },
      admin.id,
    );
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to save." };
  }

  revalidateSettings();
  return { status: "success" };
}
