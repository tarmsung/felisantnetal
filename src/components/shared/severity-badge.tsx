import { StatusBadge } from "@/components/shared/status-badge";
import type { RiskSeverity } from "@/types/database";

const CONFIG: Record<RiskSeverity, { label: string; tone: "info" | "warning" | "destructive" }> = {
  low: { label: "Low", tone: "info" },
  medium: { label: "Medium", tone: "warning" },
  high: { label: "High", tone: "destructive" },
  critical: { label: "Critical", tone: "destructive" },
};

/** Severity as configured on the clinical_rules row that raised the flag (spec section 11) — never a diagnosis, just how the rule was set up. */
export function SeverityBadge({ severity, className }: { severity: RiskSeverity; className?: string }) {
  const config = CONFIG[severity];
  return <StatusBadge label={config.label} tone={config.tone} className={className} />;
}
