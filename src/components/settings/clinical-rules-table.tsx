"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateClinicalRuleAction } from "@/app/(app)/settings/actions";
import type { ClinicalRuleRow, RiskSeverity, RuleOperator } from "@/types/database";

const SEVERITY_OPTIONS: { value: RiskSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const OPERATOR_DESCRIPTIONS: Record<RuleOperator, string> = {
  lt: "Triggers when the value is below the threshold",
  lte: "Triggers when the value is at or below the threshold",
  gt: "Triggers when the value is above the threshold",
  gte: "Triggers when the value is at or above the threshold",
  between: "Triggers when the value is between the minimum and maximum, inclusive",
  outside: "Triggers when the value is below the minimum or above the maximum",
};

const TWO_SIDED: RuleOperator[] = ["between", "outside"];

export function ClinicalRulesTable({ rules }: { rules: ClinicalRuleRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Evaluated automatically every time a clinical visit is recorded. A rule stays inactive
        until you give it a real threshold from the clinic&apos;s approved guideline — this system
        never invents or suggests one (spec section 11).
      </p>
      <div className="flex flex-col gap-3">
        {rules.map((rule) => (
          <ClinicalRuleCard key={rule.id} rule={rule} />
        ))}
      </div>
    </div>
  );
}

function ClinicalRuleCard({ rule }: { rule: ClinicalRuleRow }) {
  const [pending, startTransition] = useTransition();
  const [min, setMin] = useState(rule.threshold_min != null ? String(rule.threshold_min) : "");
  const [max, setMax] = useState(rule.threshold_max != null ? String(rule.threshold_max) : "");
  const [severity, setSeverity] = useState<RiskSeverity>(rule.severity);
  const [isActive, setIsActive] = useState(rule.is_active);
  const twoSided = TWO_SIDED.includes(rule.operator);

  const dirty =
    min !== (rule.threshold_min != null ? String(rule.threshold_min) : "") ||
    max !== (rule.threshold_max != null ? String(rule.threshold_max) : "") ||
    severity !== rule.severity ||
    isActive !== rule.is_active;

  function save() {
    startTransition(async () => {
      const result = await updateClinicalRuleAction(rule.id, {
        threshold_min: min,
        threshold_max: max,
        severity,
        is_active: isActive,
      });
      if (result.status === "error") {
        toast.error(result.message ?? "Failed to save.");
        return;
      }
      toast.success(`${rule.label} updated.`);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{rule.label}</p>
          <p className="text-xs text-muted-foreground">
            Field: <code>{rule.field}</code> · {OPERATOR_DESCRIPTIONS[rule.operator]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Active</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <label className="text-xs text-muted-foreground">{twoSided ? "Minimum" : "Threshold"}</label>
          <Input type="number" step="0.1" value={min} onChange={(e) => setMin(e.target.value)} placeholder="Not set" />
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs text-muted-foreground">Maximum</label>
          <Input
            type="number"
            step="0.1"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder={twoSided ? "Not set" : "Not used"}
            disabled={!twoSided}
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs text-muted-foreground">Severity</label>
          <Select value={severity} onValueChange={(v) => v && setSeverity(v as RiskSeverity)}>
            <SelectTrigger>
              <SelectValue>{(value: string) => SEVERITY_OPTIONS.find((o) => o.value === value)?.label ?? "Low"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button size="sm" variant="outline" onClick={save} disabled={pending || !dirty} className="w-full">
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
