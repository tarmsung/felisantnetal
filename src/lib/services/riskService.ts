import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent, diffForAudit } from "@/lib/services/auditService";
import { evaluateVisitAgainstRules } from "@/lib/services/riskRules";
import type {
  ClinicalRuleRow,
  ClinicalVisitRow,
  RiskFlagRow,
  RiskFlagStatus,
  RiskSeverity,
} from "@/types/database";

export { evaluateRule, evaluateVisitAgainstRules } from "@/lib/services/riskRules";
export type { EvaluableVisit, TriggeredRule } from "@/lib/services/riskRules";

/**
 * Phase 4 (spec section 43): the configurable clinical rules engine.
 * Evaluates a new clinical_visits row against every active row in
 * clinical_rules and raises risk_flags rows, recording rule_version for
 * traceability. Deliberately does not — and must never — invent
 * threshold values itself (spec section 11); it only evaluates what an
 * administrator has configured and activated (migration 0010 seeds every
 * rule with is_active = false and null thresholds for exactly this
 * reason — see that migration's comment). The pure evaluation logic
 * itself lives in riskRules.ts (no "server-only", so it's directly unit
 * testable — see riskService.test.ts); this file owns everything that
 * touches the database.
 */

export async function getActiveClinicalRules(): Promise<ClinicalRuleRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clinical_rules")
    .select("*")
    .eq("is_active", true);

  if (error) throw new Error(`Failed to load clinical rules: ${error.message}`);
  return data ?? [];
}

/** Backs the Settings page's Clinical Rules tab (Phase 8) — all five configured slots, active or not. */
export async function listAllClinicalRules(): Promise<ClinicalRuleRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("clinical_rules").select("*").order("field");
  if (error) throw new Error(`Failed to load clinical rules: ${error.message}`);
  return data ?? [];
}

export interface UpdateClinicalRuleInput {
  thresholdMin?: number;
  thresholdMax?: number;
  severity: RiskSeverity;
  isActive: boolean;
}

/** Whether `rule.operator` has every threshold it needs to ever evaluate to true — see riskRules.ts's documented threshold convention. */
function hasRequiredThresholds(operator: ClinicalRuleRow["operator"], min?: number, max?: number): boolean {
  if (operator === "between" || operator === "outside") return min != null && max != null;
  return min != null;
}

/**
 * Activating a rule with thresholds its own operator can't use would
 * pass validation but then never fire (riskRules.evaluateRule fails
 * safe on a missing threshold) — a silent, hard-to-notice
 * misconfiguration. Caught here instead of left for a nurse to
 * eventually wonder why a rule "isn't working".
 */
export async function updateClinicalRule(
  id: string,
  input: UpdateClinicalRuleInput,
  actingAdminId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: before, error: fetchError } = await supabase
    .from("clinical_rules")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !before) throw new Error(`Rule not found: ${fetchError?.message ?? "unknown error"}`);

  if (input.isActive && !hasRequiredThresholds(before.operator, input.thresholdMin, input.thresholdMax)) {
    const needed = before.operator === "between" || before.operator === "outside" ? "a minimum and a maximum" : "a minimum";
    throw new Error(`This rule's "${before.operator}" comparison needs ${needed} threshold before it can be activated.`);
  }

  const { error } = await supabase
    .from("clinical_rules")
    .update({
      threshold_min: input.thresholdMin ?? null,
      threshold_max: input.thresholdMax ?? null,
      severity: input.severity,
      is_active: input.isActive,
      version: before.version + 1,
      updated_by: actingAdminId,
    })
    .eq("id", id);
  if (error) throw new Error(`Failed to update rule: ${error.message}`);

  const { data: after } = await supabase.from("clinical_rules").select("*").eq("id", id).maybeSingle();
  const diff = after ? diffForAudit(before, after) : null;
  if (diff) {
    await logAuditEvent({
      userId: actingAdminId,
      action: "clinical_rule.update",
      entityType: "clinical_rule",
      entityId: id,
      ...diff,
    });
  }
}

/**
 * Runs a just-recorded visit through every active rule and raises a
 * risk_flags row for each one triggered. Also updates the visit's own
 * risk_flag/risk_reason summary columns so list views don't need to
 * join risk_flags just to show a badge. Called once, at record time —
 * see clinicalVisitService.recordVisit and its comment on why an admin
 * correction afterwards does not re-run this.
 */
export async function evaluateAndFlagVisit(
  visit: ClinicalVisitRow,
  actingUserId: string | null,
): Promise<RiskFlagRow[]> {
  const rules = await getActiveClinicalRules();
  const triggered = evaluateVisitAgainstRules(visit, rules);
  if (triggered.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("risk_flags")
    .insert(
      triggered.map(({ rule, value }) => ({
        patient_id: visit.patient_id,
        pregnancy_id: visit.pregnancy_id,
        visit_id: visit.id,
        flag_type: rule.rule_key,
        severity: rule.severity,
        reason: `${rule.message} (${rule.label}: recorded value ${value})`,
        rule_version: rule.version,
        status: "active" as RiskFlagStatus,
      })),
    )
    .select("*");

  if (error || !data) {
    throw new Error(`Failed to raise risk flag: ${error?.message ?? "unknown error"}`);
  }

  for (const flag of data) {
    await logAuditEvent({
      userId: actingUserId,
      action: "risk_flag.raise",
      entityType: "risk_flag",
      entityId: flag.id,
      newValues: {
        flag_type: flag.flag_type,
        severity: flag.severity,
        reason: flag.reason,
        visit_id: flag.visit_id,
      },
    });
  }

  const { error: summaryError } = await supabase
    .from("clinical_visits")
    .update({ risk_flag: true, risk_reason: data.map((f) => f.reason).join(" | ") })
    .eq("id", visit.id);
  if (summaryError) {
    console.error("[riskService] failed to update visit risk summary:", summaryError.message);
  }

  return data;
}

export async function listRiskFlagsForVisit(visitId: string): Promise<RiskFlagRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("risk_flags")
    .select("*")
    .eq("visit_id", visitId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load risk flags: ${error.message}`);
  return data ?? [];
}

export async function listRiskFlagsForPatient(patientId: string): Promise<RiskFlagRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("risk_flags")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load risk flags: ${error.message}`);
  return data ?? [];
}

const SEVERITY_RANK: Record<RiskSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export interface HighRiskFilters {
  severity?: RiskSeverity;
}

export interface HighRiskPatientRow {
  patientId: string;
  patientFullName: string;
  patientNumber: string;
  patientPhone: string | null;
  communityHealthWorkerName: string | null;
  activeFlagCount: number;
  highestSeverity: RiskSeverity;
  latestReason: string;
  latestFlaggedAt: string;
}

/**
 * Backs the High Risk page (spec section 12). Never claims a diagnosis
 * (spec section 48) — "high risk" here means exactly one thing: this
 * patient has at least one risk_flags row with status = 'active', which
 * patients.risk_status already mirrors via the sync_patient_risk_status
 * trigger (migration 0007). This groups the underlying flags so a nurse
 * can see *why*, not just that a badge is red.
 */
export async function listHighRiskPatients(
  filters: HighRiskFilters = {},
): Promise<HighRiskPatientRow[]> {
  const supabase = await createSupabaseServerClient();

  let builder = supabase.from("risk_flags").select("*").eq("status", "active");
  if (filters.severity) builder = builder.eq("severity", filters.severity);

  const { data, error } = await builder.order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load active risk flags: ${error.message}`);

  const flags = data ?? [];
  if (flags.length === 0) return [];

  // `flags` is already ordered newest-first, so the first entry pushed
  // into each patient's bucket below is that patient's most recent flag.
  const byPatient = new Map<string, RiskFlagRow[]>();
  for (const flag of flags) {
    const list = byPatient.get(flag.patient_id) ?? [];
    list.push(flag);
    byPatient.set(flag.patient_id, list);
  }

  const patientIds = Array.from(byPatient.keys());
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, patient_number, phone, community_health_worker_id")
    .in("id", patientIds);
  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));

  const chwIds = Array.from(
    new Set(
      (patients ?? [])
        .map((p) => p.community_health_worker_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const { data: chwRows } = chwIds.length
    ? await supabase.from("community_health_workers").select("id, full_name").in("id", chwIds)
    : { data: [] as { id: string; full_name: string }[] };
  const chwNameById = new Map((chwRows ?? []).map((c) => [c.id, c.full_name]));

  return patientIds
    .map((patientId) => {
      const patientFlags = byPatient.get(patientId) as RiskFlagRow[];
      const highest = patientFlags.reduce((a, b) =>
        SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a,
      );
      const patient = patientById.get(patientId);
      return {
        patientId,
        patientFullName: patient?.full_name ?? "Unknown patient",
        patientNumber: patient?.patient_number ?? "—",
        patientPhone: patient?.phone ?? null,
        communityHealthWorkerName: patient?.community_health_worker_id
          ? (chwNameById.get(patient.community_health_worker_id) ?? null)
          : null,
        activeFlagCount: patientFlags.length,
        highestSeverity: highest.severity,
        latestReason: patientFlags[0].reason,
        latestFlaggedAt: patientFlags[0].created_at,
      };
    })
    .sort(
      (a, b) =>
        SEVERITY_RANK[b.highestSeverity] - SEVERITY_RANK[a.highestSeverity] ||
        new Date(b.latestFlaggedAt).getTime() - new Date(a.latestFlaggedAt).getTime(),
    );
}

export type RiskFlagReviewStatus = Extract<RiskFlagStatus, "reviewed" | "resolved">;

/**
 * Moves a flag through the review workflow. Only ever sends the four
 * columns migration 0007's protect_risk_flag_history trigger allows to
 * change after creation — the flag's own what/why/severity/when is
 * permanent history (see that migration's comment on risk_flags).
 */
export async function reviewRiskFlag(
  flagId: string,
  status: RiskFlagReviewStatus,
  reviewNotes: string | undefined,
  actingUserId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("risk_flags")
    .select("status")
    .eq("id", flagId)
    .single();

  const patch: { status: RiskFlagStatus; review_notes: string | null; resolved_at?: string; resolved_by?: string } = {
    status,
    review_notes: reviewNotes ?? null,
  };
  if (status === "resolved") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = actingUserId;
  }

  const { error } = await supabase.from("risk_flags").update(patch).eq("id", flagId);
  if (error) throw new Error(`Failed to update risk flag: ${error.message}`);

  await logAuditEvent({
    userId: actingUserId,
    action: status === "resolved" ? "risk_flag.resolve" : "risk_flag.review",
    entityType: "risk_flag",
    entityId: flagId,
    oldValues: { status: before?.status ?? null },
    newValues: { status, review_notes: reviewNotes ?? null },
  });
}
