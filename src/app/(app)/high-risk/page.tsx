import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listHighRiskPatients } from "@/lib/services/riskService";
import { HighRiskFilters } from "@/components/risk/high-risk-filters";
import { HighRiskTable } from "@/components/risk/high-risk-table";
import { EmptyState } from "@/components/shared/empty-state";
import type { RiskSeverity } from "@/types/database";

export const metadata: Metadata = { title: "High Risk" };

const VALID_SEVERITIES: RiskSeverity[] = ["low", "medium", "high", "critical"];

export default async function HighRiskPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string }>;
}) {
  await requireUser();
  const { severity } = await searchParams;
  const severityFilter = VALID_SEVERITIES.find((s) => s === severity);

  const rows = await listHighRiskPatients({ severity: severityFilter });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Every patient with at least one active clinical review flag (spec section 12) — this
        reflects reviewer judgement, not a diagnosis.
      </p>
      <HighRiskFilters />

      {rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={severityFilter ? `No patients flagged at ${severityFilter} severity` : "No patients currently flagged"}
          description="Patients appear here automatically when a recorded clinical visit triggers a configured risk rule."
        />
      ) : (
        <HighRiskTable rows={rows} />
      )}
    </div>
  );
}
