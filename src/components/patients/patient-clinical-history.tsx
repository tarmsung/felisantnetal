import { Stethoscope, AlertTriangle, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { formatClinicDateTime } from "@/lib/dates";
import type { ClinicalVisitWithRecorder } from "@/lib/services/clinicalVisitService";
import type { RiskFlagRow } from "@/types/database";

type TimelineEntry =
  | { kind: "visit"; timestamp: string; visit: ClinicalVisitWithRecorder }
  | { kind: "flag_raised"; timestamp: string; flag: RiskFlagRow }
  | { kind: "flag_resolved"; timestamp: string; flag: RiskFlagRow };

/**
 * A reverse-chronological narrative combining what the structured "ANC
 * Visits" and "Risk Flags" tabs show as data — read-only, nothing to
 * action here. Distinct from those two tabs on purpose: this is the
 * "what actually happened, in order" view a nurse handing off a case
 * would want, not another table of the same rows.
 */
export function PatientClinicalHistory({
  visits,
  flags,
}: {
  visits: ClinicalVisitWithRecorder[];
  flags: RiskFlagRow[];
}) {
  const entries: TimelineEntry[] = [
    ...visits.map((visit): TimelineEntry => ({ kind: "visit", timestamp: visit.created_at, visit })),
    ...flags.map((flag): TimelineEntry => ({ kind: "flag_raised", timestamp: flag.created_at, flag })),
    ...flags
      .filter((flag) => flag.status === "resolved" && flag.resolved_at)
      .map((flag): TimelineEntry => ({ kind: "flag_resolved", timestamp: flag.resolved_at as string, flag })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="No clinical history yet"
        description="Visits and risk flags will appear here as they're recorded."
      />
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry, i) => (
        <li key={`${entry.kind}-${i}`} className="flex gap-3 rounded-lg border border-border p-3">
          <div className="mt-0.5 shrink-0">
            {entry.kind === "visit" ? (
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
            ) : entry.kind === "flag_resolved" ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                {entry.kind === "visit"
                  ? `Visit ${entry.visit.visit_number} recorded`
                  : entry.kind === "flag_resolved"
                    ? "Risk flag resolved"
                    : "Risk flag raised"}
              </span>
              {entry.kind !== "visit" ? <SeverityBadge severity={entry.flag.severity} /> : null}
              <span className="text-xs text-muted-foreground">{formatClinicDateTime(entry.timestamp)}</span>
            </div>
            {entry.kind === "visit" ? (
              <>
                {entry.visit.clinical_notes ? (
                  <p className="text-sm text-foreground/80">{entry.visit.clinical_notes}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">Recorded by {entry.visit.recorded_by_name}</p>
              </>
            ) : (
              <p className="text-sm text-foreground/80">
                {entry.kind === "flag_resolved" && entry.flag.review_notes
                  ? entry.flag.review_notes
                  : entry.flag.reason}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
