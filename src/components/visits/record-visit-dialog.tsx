"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, Plus } from "lucide-react";
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
import { clinicDateKey } from "@/lib/dates";
import {
  recordVisitAction,
  getNextVisitNumberAction,
  searchPatientsForVisitAction,
  type PatientPickerResult,
} from "@/app/(app)/visits/actions";

export interface SelectedVisitPatient {
  id: string;
  fullName: string;
  patientNumber: string;
  pregnancyId: string;
}

export interface InitialVisitAppointment {
  id: string;
  visitNumber: number | null;
}

interface RecordVisitDialogProps {
  /** Pass when opened from a patient's own profile or an appointment — skips the search step. */
  initialPatient?: SelectedVisitPatient;
  /** Pass when opened from a scheduled/missed appointment — links the visit and prefills the visit number. */
  initialAppointment?: InitialVisitAppointment;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  onCreated?: () => void;
}

/** Self-triggering dialog for /visits and a patient's own profile. For the appointment-detail-sheet flow, see RecordVisitForm used directly inside a controlled Dialog there. */
export function RecordVisitDialog({
  initialPatient,
  initialAppointment,
  triggerLabel = "Record visit",
  triggerVariant = "default",
  onCreated,
}: RecordVisitDialogProps) {
  const [open, setOpen] = useState(false);
  // See add-appointment-dialog.tsx's comment on this pattern.
  const [sessionId, setSessionId] = useState(0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={triggerVariant}
        onClick={() => {
          setSessionId((n) => n + 1);
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" />
        {triggerLabel}
      </Button>
      <DialogContent className="sm:max-w-lg">
        <RecordVisitForm
          key={sessionId}
          initialPatient={initialPatient}
          initialAppointment={initialAppointment}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            onCreated?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function RecordVisitForm({
  initialPatient,
  initialAppointment,
  onClose,
  onCreated,
}: {
  initialPatient?: SelectedVisitPatient;
  initialAppointment?: InitialVisitAppointment;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const [patient, setPatient] = useState<SelectedVisitPatient | undefined>(initialPatient);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientPickerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [visitNumber, setVisitNumber] = useState(
    initialAppointment?.visitNumber ? String(initialAppointment.visitNumber) : "",
  );
  const [visitNumberNote, setVisitNumberNote] = useState<string | undefined>();
  const [visitDate, setVisitDate] = useState(clinicDateKey(new Date().toISOString()));
  const [weightKg, setWeightKg] = useState("");
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [fundalHeightCm, setFundalHeightCm] = useState("");
  const [fetalHeartRate, setFetalHeartRate] = useState("");
  const [hbGDl, setHbGDl] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  useEffect(() => {
    if (!patient || initialAppointment?.visitNumber) return;
    let cancelled = false;
    getNextVisitNumberAction(patient.pregnancyId).then((suggestion) => {
      if (cancelled) return;
      if (suggestion.visitNumber) {
        setVisitNumber(String(suggestion.visitNumber));
        setVisitNumberNote(undefined);
      } else {
        setVisitNumberNote("Every configured ANC visit already has a recorded entry — check the visit number.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [patient, initialAppointment]);

  function handleQueryChange(next: string) {
    setQuery(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchPatientsForVisitAction(next);
      setResults(found);
      setSearching(false);
    }, 300);
  }

  function submit() {
    if (!patient) return;
    setError(undefined);
    startTransition(async () => {
      const result = await recordVisitAction({
        patient_id: patient.id,
        pregnancy_id: patient.pregnancyId,
        appointment_id: initialAppointment?.id ?? "",
        visit_number: visitNumber,
        visit_date: visitDate,
        weight_kg: weightKg,
        blood_pressure_systolic: bpSystolic,
        blood_pressure_diastolic: bpDiastolic,
        fundal_height_cm: fundalHeightCm,
        fetal_heart_rate: fetalHeartRate,
        hb_g_dl: hbGDl,
        clinical_notes: clinicalNotes,
      });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      if (result.riskEvaluationError) {
        toast.warning(result.riskEvaluationError);
      } else if (result.riskFlagCount && result.riskFlagCount > 0) {
        toast.warning(
          `Visit recorded. ${result.riskFlagCount} risk flag${result.riskFlagCount === 1 ? "" : "s"} raised for clinical review.`,
        );
      } else {
        toast.success("Visit recorded.");
      }
      onCreated();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{patient ? "Record ANC visit" : "Find a patient"}</DialogTitle>
        <DialogDescription>
          {patient
            ? `${patient.fullName} · ${patient.patientNumber}`
            : "Search by patient number, name, national ID, or phone."}
        </DialogDescription>
      </DialogHeader>

      {!patient ? (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search patients…"
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {searching ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Searching…</p>
            ) : results.length === 0 && query.trim() ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No patients found.</p>
            ) : (
              results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  disabled={!result.pregnancyId}
                  onClick={() =>
                    result.pregnancyId &&
                    setPatient({
                      id: result.id,
                      fullName: result.fullName,
                      patientNumber: result.patientNumber,
                      pregnancyId: result.pregnancyId,
                    })
                  }
                  className="flex flex-col items-start rounded-lg px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="font-medium">{result.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {result.patientNumber}
                    {!result.pregnancyId ? " · No pregnancy on file" : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="visit-number">Visit number</Label>
              <Input
                id="visit-number"
                type="number"
                min={1}
                max={30}
                value={visitNumber}
                onChange={(e) => setVisitNumber(e.target.value)}
                disabled={Boolean(initialAppointment?.visitNumber)}
              />
              {visitNumberNote ? <p className="text-xs text-muted-foreground">{visitNumberNote}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="visit-date">Visit date</Label>
              <Input
                id="visit-date"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="weight-kg">Weight (kg)</Label>
              <Input
                id="weight-kg"
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="bp-systolic">BP systolic</Label>
                <Input
                  id="bp-systolic"
                  type="number"
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(e.target.value)}
                  placeholder="mmHg"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bp-diastolic">BP diastolic</Label>
                <Input
                  id="bp-diastolic"
                  type="number"
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(e.target.value)}
                  placeholder="mmHg"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fundal-height">Fundal height (cm)</Label>
              <Input
                id="fundal-height"
                type="number"
                step="0.1"
                value={fundalHeightCm}
                onChange={(e) => setFundalHeightCm(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fhr">Fetal heart rate (bpm)</Label>
              <Input
                id="fhr"
                type="number"
                value={fetalHeartRate}
                onChange={(e) => setFetalHeartRate(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="hb">Haemoglobin (g/dL)</Label>
            <Input
              id="hb"
              type="number"
              step="0.1"
              className="max-w-[calc(50%-0.5rem)]"
              value={hbGDl}
              onChange={(e) => setHbGDl(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clinical-notes">Clinical notes</Label>
            <Textarea
              id="clinical-notes"
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Optional — observations, advice given, follow-up needed"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      )}

      <DialogFooter>
        {patient && !initialPatient ? (
          <Button variant="ghost" onClick={() => setPatient(undefined)} disabled={pending}>
            Back
          </Button>
        ) : null}
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        {patient ? (
          <Button onClick={submit} disabled={pending || !visitNumber || !visitDate}>
            {pending ? "Saving…" : "Record visit"}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
