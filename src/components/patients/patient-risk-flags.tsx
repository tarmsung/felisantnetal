"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { RiskFlagItem } from "@/components/risk/risk-flag-item";
import type { RiskFlagRow } from "@/types/database";

export function PatientRiskFlags({
  patientId,
  flags,
}: {
  patientId: string;
  flags: RiskFlagRow[];
}) {
  const router = useRouter();

  if (flags.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No risk flags for this patient"
        description="A flag is raised automatically when a recorded clinical visit triggers a configured risk rule."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {flags.map((flag) => (
        <RiskFlagItem key={flag.id} flag={flag} patientId={patientId} onChanged={() => router.refresh()} />
      ))}
    </div>
  );
}
