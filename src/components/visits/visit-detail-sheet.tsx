"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { EditVisitDialog } from "@/components/visits/edit-visit-dialog";
import { getRiskFlagsForVisitAction } from "@/app/(app)/visits/actions";
import { formatDisplayDate } from "@/lib/dates";
import type { ClinicalVisitListRow } from "@/lib/services/clinicalVisitService";
import type { RiskFlagRow } from "@/types/database";

const VITALS: Array<{ key: keyof ClinicalVisitListRow; label: string; unit: string }> = [
  { key: "weight_kg", label: "Weight", unit: "kg" },
  { key: "blood_pressure_systolic", label: "BP systolic", unit: "mmHg" },
  { key: "blood_pressure_diastolic", label: "BP diastolic", unit: "mmHg" },
  { key: "fundal_height_cm", label: "Fundal height", unit: "cm" },
  { key: "fetal_heart_rate", label: "Fetal heart rate", unit: "bpm" },
  { key: "hb_g_dl", label: "Haemoglobin", unit: "g/dL" },
];

export function VisitDetailSheet({
  visit,
  open,
  onOpenChange,
  onChanged,
  isAdmin,
  hidePatientLink,
}: {
  visit: ClinicalVisitListRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  isAdmin: boolean;
  /** Suppress the "View patient profile" link when the sheet is already rendered on that profile. */
  hidePatientLink?: boolean;
}) {
  const [riskFlags, setRiskFlags] = useState<RiskFlagRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!visit || !open) return;
    let cancelled = false;
    getRiskFlagsForVisitAction(visit.id).then((flags) => {
      if (!cancelled) setRiskFlags(flags);
    });
    return () => {
      cancelled = true;
    };
  }, [visit, open]);

  if (!visit) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col gap-5 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Visit {visit.visit_number}</SheetTitle>
            <SheetDescription>
              {visit.patient_full_name} · {visit.patient_number} · {formatDisplayDate(visit.visit_date)}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4">
            {riskFlags.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Risk flags raised
                </p>
                {riskFlags.map((flag) => (
                  <div key={flag.id} className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={flag.severity} />
                      <span className="text-xs text-muted-foreground">
                        {flag.status === "active" ? "Awaiting review" : flag.status}
                      </span>
                    </div>
                    <p className="text-foreground/80">{flag.reason}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              {VITALS.map(({ key, label, unit }) => {
                const value = visit[key];
                return (
                  <div key={key} className="rounded-lg border border-border p-2.5">
                    <dt className="text-[11px] text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{value != null ? `${value} ${unit}` : "—"}</dd>
                  </div>
                );
              })}
            </dl>

            {visit.clinical_notes ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Clinical notes
                </p>
                <p className="whitespace-pre-wrap text-sm text-foreground/80">{visit.clinical_notes}</p>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">Recorded by {visit.recorded_by_name}</p>

            {!hidePatientLink ? (
              <Button
                render={<Link href={`/patients/${visit.patient_id}`} />}
                nativeButton={false}
                variant="link"
                className="h-auto justify-start px-0"
              >
                View patient profile →
              </Button>
            ) : null}
          </div>

          {isAdmin ? (
            <SheetFooter className="mt-auto">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Correct this record
              </Button>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      {isAdmin ? (
        <EditVisitDialog
          visit={visit}
          open={editOpen}
          onOpenChange={setEditOpen}
          onDone={() => onChanged?.()}
        />
      ) : null}
    </>
  );
}
