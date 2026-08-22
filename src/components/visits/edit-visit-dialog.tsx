"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { updateVisitAdminAction } from "@/app/(app)/visits/actions";
import type { ClinicalVisitRow } from "@/types/database";

/**
 * Administrator-only correction (spec section 10 — see
 * clinicalVisitService.updateVisitAdmin's comment for why this never
 * re-runs the risk rules engine). RLS backs this up independently even
 * if this dialog were somehow reachable by a nurse.
 */
export function EditVisitDialog({
  visit,
  open,
  onOpenChange,
  onDone,
}: {
  visit: ClinicalVisitRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const [weightKg, setWeightKg] = useState(visit.weight_kg != null ? String(visit.weight_kg) : "");
  const [bpSystolic, setBpSystolic] = useState(
    visit.blood_pressure_systolic != null ? String(visit.blood_pressure_systolic) : "",
  );
  const [bpDiastolic, setBpDiastolic] = useState(
    visit.blood_pressure_diastolic != null ? String(visit.blood_pressure_diastolic) : "",
  );
  const [fundalHeightCm, setFundalHeightCm] = useState(
    visit.fundal_height_cm != null ? String(visit.fundal_height_cm) : "",
  );
  const [fetalHeartRate, setFetalHeartRate] = useState(
    visit.fetal_heart_rate != null ? String(visit.fetal_heart_rate) : "",
  );
  const [hbGDl, setHbGDl] = useState(visit.hb_g_dl != null ? String(visit.hb_g_dl) : "");
  const [clinicalNotes, setClinicalNotes] = useState(visit.clinical_notes ?? "");
  const [reason, setReason] = useState("");

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await updateVisitAdminAction(visit.id, visit.patient_id, {
        weight_kg: weightKg,
        blood_pressure_systolic: bpSystolic,
        blood_pressure_diastolic: bpDiastolic,
        fundal_height_cm: fundalHeightCm,
        fetal_heart_rate: fetalHeartRate,
        hb_g_dl: hbGDl,
        clinical_notes: clinicalNotes,
        correction_reason: reason,
      });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      toast.success("Visit corrected.");
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Correct visit {visit.visit_number}</DialogTitle>
          <DialogDescription>
            This changes the historical record — a reason is required so the audit log explains why.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-weight">Weight (kg)</Label>
              <Input id="edit-weight" type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-bp-sys">BP systolic</Label>
                <Input id="edit-bp-sys" type="number" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-bp-dia">BP diastolic</Label>
                <Input id="edit-bp-dia" type="number" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-fundal">Fundal height (cm)</Label>
              <Input id="edit-fundal" type="number" step="0.1" value={fundalHeightCm} onChange={(e) => setFundalHeightCm(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-fhr">Fetal heart rate</Label>
              <Input id="edit-fhr" type="number" value={fetalHeartRate} onChange={(e) => setFetalHeartRate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-hb">Haemoglobin (g/dL)</Label>
            <Input
              id="edit-hb"
              type="number"
              step="0.1"
              className="max-w-[calc(50%-0.5rem)]"
              value={hbGDl}
              onChange={(e) => setHbGDl(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-notes">Clinical notes</Label>
            <Textarea id="edit-notes" rows={3} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-reason">Reason for correction</Label>
            <Textarea
              id="edit-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Systolic BP was transposed with diastolic at entry"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !reason.trim()}>
            {pending ? "Saving…" : "Save correction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
