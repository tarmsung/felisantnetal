import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDaysToIsoDate } from "@/lib/dates";
import { logAuditEvent, diffForAudit } from "@/lib/services/auditService";
import type { AncScheduleTemplateRow, PregnancyRow } from "@/types/database";

/**
 * The ANC scheduling engine (spec section 7). Reads
 * anc_schedule_templates (migration 20260101000006) instead of
 * hardcoding visit timing — see that migration and ARCHITECTURE.md for
 * why no gestational-week values are seeded. Until an administrator
 * configures them (Phase 8's Settings module), this engine can still
 * tell a nurse *which* visit number is next, it just can't suggest a
 * date for it — the UI must make that gap visible, never silently
 * invent one.
 */

export async function getActiveScheduleTemplates(): Promise<AncScheduleTemplateRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("anc_schedule_templates")
    .select("*")
    .eq("is_active", true)
    .order("visit_number");

  if (error) throw new Error(`Failed to load ANC schedule configuration: ${error.message}`);
  return data ?? [];
}

/** Backs the Settings page's ANC Schedule tab (Phase 8) — every configured slot, active or not, so an administrator can see and fix a mistakenly-deactivated one. */
export async function listAllAncScheduleTemplates(): Promise<AncScheduleTemplateRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("anc_schedule_templates").select("*").order("visit_number");
  if (error) throw new Error(`Failed to load ANC schedule configuration: ${error.message}`);
  return data ?? [];
}

export interface UpdateAncScheduleTemplateInput {
  recommendedGestationalWeek?: number;
  isActive: boolean;
  notes?: string;
}

export async function updateAncScheduleTemplate(
  id: string,
  input: UpdateAncScheduleTemplateInput,
  actingAdminId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: before, error: fetchError } = await supabase
    .from("anc_schedule_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !before) throw new Error(`Schedule slot not found: ${fetchError?.message ?? "unknown error"}`);

  const { error } = await supabase
    .from("anc_schedule_templates")
    .update({
      recommended_gestational_week: input.recommendedGestationalWeek ?? null,
      is_active: input.isActive,
      notes: input.notes ?? null,
      updated_by: actingAdminId,
    })
    .eq("id", id);
  if (error) throw new Error(`Failed to update schedule slot: ${error.message}`);

  const { data: after } = await supabase.from("anc_schedule_templates").select("*").eq("id", id).maybeSingle();
  const diff = after ? diffForAudit(before, after) : null;
  if (diff) {
    await logAuditEvent({
      userId: actingAdminId,
      action: "anc_schedule_template.update",
      entityType: "anc_schedule_template",
      entityId: id,
      ...diff,
    });
  }
}

export interface NextVisitSuggestion {
  /** Null once every configured visit has an appointment already. */
  visitNumber: number | null;
  template: AncScheduleTemplateRow | null;
  /**
   * A suggested calendar day, "YYYY-MM-DD" — only present when the
   * template's recommended_gestational_week is configured AND the
   * pregnancy's LMP is known. This is a *day* suggestion, not a time —
   * the nurse still picks the actual appointment time. Computing "LMP +
   * N weeks" is standard obstetric arithmetic, not a clinical judgement
   * call; deciding which week each visit *should* fall in is the part
   * that stays administrator-configured and is never guessed here.
   */
  suggestedDate: string | null;
  reasonNoSuggestion: string | null;
}

/**
 * Figures out which ANC visit number a patient is due for next, and — if
 * the guideline has been configured — when. `existingVisitNumbers` is
 * every visit_number already scheduled (any status) for this pregnancy,
 * so a cancelled/missed slot doesn't get silently re-suggested as "next"
 * while a completed run still counts against the total.
 */
export async function suggestNextVisit(
  pregnancy: Pick<PregnancyRow, "lmp">,
  existingVisitNumbers: number[],
): Promise<NextVisitSuggestion> {
  const templates = await getActiveScheduleTemplates();
  const usedNumbers = new Set(existingVisitNumbers);
  const nextTemplate = templates.find((t) => !usedNumbers.has(t.visit_number)) ?? null;

  if (!nextTemplate) {
    return {
      visitNumber: null,
      template: null,
      suggestedDate: null,
      reasonNoSuggestion:
        existingVisitNumbers.length > 0
          ? "Every configured ANC visit already has an appointment."
          : "No ANC visit schedule is configured.",
    };
  }

  if (nextTemplate.recommended_gestational_week == null) {
    return {
      visitNumber: nextTemplate.visit_number,
      template: nextTemplate,
      suggestedDate: null,
      reasonNoSuggestion:
        "This visit's recommended timing hasn't been configured by an administrator yet — pick a date manually.",
    };
  }

  if (!pregnancy.lmp) {
    return {
      visitNumber: nextTemplate.visit_number,
      template: nextTemplate,
      suggestedDate: null,
      reasonNoSuggestion: "No last menstrual period on file to calculate a date from.",
    };
  }

  const suggestedDate = addDaysToIsoDate(
    pregnancy.lmp,
    nextTemplate.recommended_gestational_week * 7,
  );
  if (!suggestedDate) {
    return {
      visitNumber: nextTemplate.visit_number,
      template: nextTemplate,
      suggestedDate: null,
      reasonNoSuggestion: "The recorded LMP date isn't valid.",
    };
  }

  return {
    visitNumber: nextTemplate.visit_number,
    template: nextTemplate,
    suggestedDate,
    reasonNoSuggestion: null,
  };
}

export interface NextVisitNumberSuggestion {
  visitNumber: number | null;
  template: AncScheduleTemplateRow | null;
}

/**
 * Phase 4's clinical-visit-recording counterpart to suggestNextVisit
 * above: figures out which visit NUMBER is next, with no date math at
 * all. Recording a visit happens the day it happens — there's no
 * "suggested date" to compute, so this skips the LMP/gestational-week
 * lookup entirely rather than calling suggestNextVisit and discarding
 * half its result.
 */
export async function suggestNextVisitNumber(
  existingVisitNumbers: number[],
): Promise<NextVisitNumberSuggestion> {
  const templates = await getActiveScheduleTemplates();
  const usedNumbers = new Set(existingVisitNumbers);
  const nextTemplate = templates.find((t) => !usedNumbers.has(t.visit_number)) ?? null;
  return { visitNumber: nextTemplate?.visit_number ?? null, template: nextTemplate };
}
