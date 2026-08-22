import { StatusBadge } from "@/components/shared/status-badge";
import type { RiskStatus } from "@/types/database";

/**
 * Never claims a diagnosis (spec section 48) — "High risk" here always
 * means "has an active clinical review flag", surfaced from
 * patients.risk_status (kept in sync from risk_flags, see migration
 * 0007's sync_patient_risk_status trigger).
 */
export function RiskBadge({ status }: { status: RiskStatus }) {
  if (status === "high_risk") {
    return <StatusBadge label="High risk" tone="destructive" />;
  }
  return <StatusBadge label="Normal" tone="success" />;
}
