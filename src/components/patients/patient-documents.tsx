import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Spec section 43 Phase 7: "Downloadable patient documents". Currently just the ANC card — a real PDF (@react-pdf/renderer) rendered from live patient/visit data, never a placeholder file. */
export function PatientDocuments({ patientId }: { patientId: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">ANC Card</span>
            <span className="text-xs text-muted-foreground">
              Identification, current pregnancy, and recorded visit measurements
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          render={<a href={`/patients/${patientId}/card`} target="_blank" rel="noopener noreferrer" />}
          nativeButton={false}
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      </div>
    </div>
  );
}
