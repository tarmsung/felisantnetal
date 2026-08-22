import { describe, expect, it } from "vitest";
import { evaluateRule, evaluateVisitAgainstRules } from "./riskRules";
import type { ClinicalRuleRow } from "@/types/database";

function makeRule(overrides: Partial<ClinicalRuleRow> = {}): ClinicalRuleRow {
  return {
    id: "rule-1",
    rule_key: "test_rule",
    label: "Test rule",
    field: "blood_pressure_systolic",
    operator: "gte",
    threshold_min: 140,
    threshold_max: null,
    severity: "high",
    message: "Clinical review required.",
    version: 1,
    is_active: true,
    created_by: null,
    updated_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const emptyVisit = {
  weight_kg: null,
  blood_pressure_systolic: null,
  blood_pressure_diastolic: null,
  fundal_height_cm: null,
  fetal_heart_rate: null,
  hb_g_dl: null,
};

describe("evaluateRule", () => {
  it("does not trigger when the measurement wasn't taken", () => {
    const rule = makeRule();
    expect(evaluateRule(rule, emptyVisit)).toBe(false);
  });

  it("does not trigger when the rule's threshold isn't configured, even if active", () => {
    const rule = makeRule({ threshold_min: null });
    expect(evaluateRule(rule, { ...emptyVisit, blood_pressure_systolic: 200 })).toBe(false);
  });

  it("gte: triggers at and above the threshold, not below", () => {
    const rule = makeRule({ operator: "gte", threshold_min: 140 });
    expect(evaluateRule(rule, { ...emptyVisit, blood_pressure_systolic: 139 })).toBe(false);
    expect(evaluateRule(rule, { ...emptyVisit, blood_pressure_systolic: 140 })).toBe(true);
    expect(evaluateRule(rule, { ...emptyVisit, blood_pressure_systolic: 160 })).toBe(true);
  });

  it("gt: triggers strictly above the threshold", () => {
    const rule = makeRule({ operator: "gt", threshold_min: 140 });
    expect(evaluateRule(rule, { ...emptyVisit, blood_pressure_systolic: 140 })).toBe(false);
    expect(evaluateRule(rule, { ...emptyVisit, blood_pressure_systolic: 141 })).toBe(true);
  });

  it("lt: triggers strictly below the threshold (e.g. low haemoglobin)", () => {
    const rule = makeRule({ field: "hb_g_dl", operator: "lt", threshold_min: 11 });
    expect(evaluateRule(rule, { ...emptyVisit, hb_g_dl: 11 })).toBe(false);
    expect(evaluateRule(rule, { ...emptyVisit, hb_g_dl: 10.5 })).toBe(true);
  });

  it("lte: triggers at and below the threshold", () => {
    const rule = makeRule({ field: "hb_g_dl", operator: "lte", threshold_min: 11 });
    expect(evaluateRule(rule, { ...emptyVisit, hb_g_dl: 11 })).toBe(true);
    expect(evaluateRule(rule, { ...emptyVisit, hb_g_dl: 11.1 })).toBe(false);
  });

  it("between: triggers only inside an inclusive range", () => {
    const rule = makeRule({
      field: "fetal_heart_rate",
      operator: "between",
      threshold_min: 100,
      threshold_max: 110,
    });
    expect(evaluateRule(rule, { ...emptyVisit, fetal_heart_rate: 99 })).toBe(false);
    expect(evaluateRule(rule, { ...emptyVisit, fetal_heart_rate: 105 })).toBe(true);
    expect(evaluateRule(rule, { ...emptyVisit, fetal_heart_rate: 111 })).toBe(false);
  });

  it("outside: triggers below the min or above the max, not between them", () => {
    const rule = makeRule({
      field: "fetal_heart_rate",
      operator: "outside",
      threshold_min: 110,
      threshold_max: 160,
    });
    expect(evaluateRule(rule, { ...emptyVisit, fetal_heart_rate: 109 })).toBe(true);
    expect(evaluateRule(rule, { ...emptyVisit, fetal_heart_rate: 135 })).toBe(false);
    expect(evaluateRule(rule, { ...emptyVisit, fetal_heart_rate: 161 })).toBe(true);
  });

  it("outside: requires both bounds configured, fails safe otherwise", () => {
    const rule = makeRule({
      field: "fetal_heart_rate",
      operator: "outside",
      threshold_min: 110,
      threshold_max: null,
    });
    expect(evaluateRule(rule, { ...emptyVisit, fetal_heart_rate: 300 })).toBe(false);
  });
});

describe("evaluateVisitAgainstRules", () => {
  it("returns only the rules that triggered, paired with the recorded value", () => {
    const rules = [
      makeRule({ id: "r1", field: "blood_pressure_systolic", operator: "gte", threshold_min: 140 }),
      makeRule({ id: "r2", field: "hb_g_dl", operator: "lt", threshold_min: 11 }),
    ];
    const visit = { ...emptyVisit, blood_pressure_systolic: 150, hb_g_dl: 12 };

    const triggered = evaluateVisitAgainstRules(visit, rules);
    expect(triggered).toHaveLength(1);
    expect(triggered[0].rule.id).toBe("r1");
    expect(triggered[0].value).toBe(150);
  });

  it("returns nothing when no active rule is triggered", () => {
    const rules = [makeRule({ operator: "gte", threshold_min: 140 })];
    expect(evaluateVisitAgainstRules({ ...emptyVisit, blood_pressure_systolic: 120 }, rules)).toEqual([]);
  });

  it("returns nothing against an empty rule set (nothing configured yet)", () => {
    expect(evaluateVisitAgainstRules({ ...emptyVisit, blood_pressure_systolic: 999 }, [])).toEqual([]);
  });
});
