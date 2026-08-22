import Link from "next/link";
import { Pencil, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/shared/risk-badge";
import { PatientStatusBadge } from "@/components/patients/patient-status-badge";
import { calculateEddCountdown, formatDisplayDate } from "@/lib/dates";
import type { PatientRow, PregnancyRow } from "@/types/database";

function initials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function PatientHeader({
  patient,
  pregnancy,
}: {
  patient: PatientRow;
  pregnancy: PregnancyRow | null;
}) {
  const countdown = pregnancy ? calculateEddCountdown(pregnancy.edd) : null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-accent-foreground">
          {initials(patient.full_name)}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{patient.full_name}</h2>
            <RiskBadge status={patient.risk_status} />
            <PatientStatusBadge status={patient.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{patient.patient_number}</span>
            {patient.phone ? (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {patient.phone}
              </span>
            ) : null}
            {pregnancy?.edd ? (
              <span>
                EDD {formatDisplayDate(pregnancy.edd)}
                {countdown ? ` · ${countdown.label}` : ""}
              </span>
            ) : (
              <span>No pregnancy episode on file</span>
            )}
          </div>
        </div>
      </div>

      <Button
        render={<Link href={`/patients/${patient.id}/edit`} />}
        nativeButton={false}
        variant="outline"
      >
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
    </div>
  );
}
