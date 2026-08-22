"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Stethoscope } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordVisitDialog } from "@/components/visits/record-visit-dialog";
import { VisitDetailSheet } from "@/components/visits/visit-detail-sheet";
import { formatDisplayDate } from "@/lib/dates";
import type { ClinicalVisitWithRecorder, ClinicalVisitListRow } from "@/lib/services/clinicalVisitService";
import type { RiskStatus } from "@/types/database";

export function PatientVisits({
  patientId,
  pregnancyId,
  patientName,
  patientNumber,
  patientRiskStatus,
  visits,
  isAdmin,
}: {
  patientId: string;
  pregnancyId: string | null;
  patientName: string;
  patientNumber: string;
  patientRiskStatus: RiskStatus;
  visits: ClinicalVisitWithRecorder[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // VisitDetailSheet is shared with the clinic-wide /visits table, which
  // needs patient_full_name/number/risk_status per row — supplied here
  // from props already in scope rather than a second query, since every
  // row on this tab is for the same patient.
  const listRows: ClinicalVisitListRow[] = visits.map((visit) => ({
    ...visit,
    patient_full_name: patientName,
    patient_number: patientNumber,
    patient_risk_status: patientRiskStatus,
  }));
  const selected = listRows.find((v) => v.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        {pregnancyId ? (
          <RecordVisitDialog
            initialPatient={{ id: patientId, fullName: patientName, patientNumber, pregnancyId }}
            onCreated={() => router.refresh()}
          />
        ) : null}
      </div>

      {visits.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No ANC visits recorded yet"
          description="Record this patient's first clinical visit to get started."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {listRows.map((visit) => (
            <li key={visit.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(visit.id);
                  setOpen(true);
                }}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/50"
              >
                <div className="flex flex-col">
                  <span className="font-medium">Visit {visit.visit_number}</span>
                  <span className="text-xs text-muted-foreground">{formatDisplayDate(visit.visit_date)}</span>
                </div>
                {visit.risk_flag ? (
                  <span className="text-xs font-semibold text-destructive">Flagged</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <VisitDetailSheet
        visit={selected}
        open={open}
        onOpenChange={setOpen}
        onChanged={() => router.refresh()}
        isAdmin={isAdmin}
        hidePatientLink
      />
    </div>
  );
}
