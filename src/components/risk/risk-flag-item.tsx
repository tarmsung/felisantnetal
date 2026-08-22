"use client";

import { useState } from "react";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ReviewRiskFlagDialog } from "@/components/risk/review-risk-flag-dialog";
import { formatClinicDateTime } from "@/lib/dates";
import type { RiskFlagRow } from "@/types/database";

const STATUS_TONE = {
  active: "destructive",
  reviewed: "warning",
  resolved: "success",
} as const;

/** One risk flag with its severity, reason, and (if active) a way to review it — used on both the High Risk page and a patient's own Risk Flags tab. */
export function RiskFlagItem({
  flag,
  patientId,
  onChanged,
}: {
  flag: RiskFlagRow;
  patientId: string;
  onChanged?: () => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={flag.severity} />
        <StatusBadge
          label={flag.status === "active" ? "Awaiting review" : flag.status === "reviewed" ? "Reviewed" : "Resolved"}
          tone={STATUS_TONE[flag.status]}
        />
        <span className="text-xs text-muted-foreground">{formatClinicDateTime(flag.created_at)}</span>
      </div>
      <p className="text-sm">{flag.reason}</p>
      {flag.review_notes ? (
        <p className="text-xs text-muted-foreground">Review notes: {flag.review_notes}</p>
      ) : null}
      {flag.status === "active" ? (
        <div>
          <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)}>
            Review
          </Button>
        </div>
      ) : null}

      <ReviewRiskFlagDialog
        flagId={flag.id}
        patientId={patientId}
        flagReason={flag.reason}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDone={onChanged}
      />
    </div>
  );
}
