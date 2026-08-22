import type { ClinicalRuleRow, ClinicalVisitRow } from "@/types/database";

/**
 * The pure half of the clinical rules engine — no I/O, no "server-only"
 * (unlike riskService.ts, which owns the Supabase reads/writes and
 * imports this). Split out specifically so it's directly unit-testable
 * the same way lib/dates.ts and lib/calendar.ts are — see
 * riskService.test.ts.
 *
 * Threshold convention (an implementation decision, not something the
 * spec dictates — documented here and in ARCHITECTURE.md): for the
 * single-sided operators (lt/lte/gt/gte), `threshold_min` is read as
 * *the* configured cutoff value — `threshold_max` is ignored for those.
 * Both thresholds together only matter for the two-sided operators
 * (between/outside). A rule missing the threshold(s) its operator needs
 * simply never triggers (fails safe) rather than throwing, since that's
 * an administrator misconfiguration, not a data problem with the visit
 * being recorded.
 */

const CLINICAL_FIELDS = [
  "weight_kg",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "fundal_height_cm",
  "fetal_heart_rate",
  "hb_g_dl",
] as const;
type ClinicalField = (typeof CLINICAL_FIELDS)[number];

function isClinicalField(field: string): field is ClinicalField {
  return (CLINICAL_FIELDS as readonly string[]).includes(field);
}

export type EvaluableVisit = Pick<ClinicalVisitRow, ClinicalField>;

function extractFieldValue(visit: EvaluableVisit, field: string): number | null {
  if (!isClinicalField(field)) return null;
  const value = visit[field];
  return typeof value === "number" ? value : null;
}

export function evaluateRule(rule: ClinicalRuleRow, visit: EvaluableVisit): boolean {
  const value = extractFieldValue(visit, rule.field);
  if (value == null) return false; // measurement not taken this visit — nothing to evaluate

  switch (rule.operator) {
    case "lt":
      return rule.threshold_min != null && value < rule.threshold_min;
    case "lte":
      return rule.threshold_min != null && value <= rule.threshold_min;
    case "gt":
      return rule.threshold_min != null && value > rule.threshold_min;
    case "gte":
      return rule.threshold_min != null && value >= rule.threshold_min;
    case "between":
      return (
        rule.threshold_min != null &&
        rule.threshold_max != null &&
        value >= rule.threshold_min &&
        value <= rule.threshold_max
      );
    case "outside":
      return (
        rule.threshold_min != null &&
        rule.threshold_max != null &&
        (value < rule.threshold_min || value > rule.threshold_max)
      );
    default:
      return false;
  }
}

export interface TriggeredRule {
  rule: ClinicalRuleRow;
  value: number;
}

export function evaluateVisitAgainstRules(
  visit: EvaluableVisit,
  rules: ClinicalRuleRow[],
): TriggeredRule[] {
  return rules
    .filter((rule) => evaluateRule(rule, visit))
    .map((rule) => ({ rule, value: extractFieldValue(visit, rule.field) as number }));
}
