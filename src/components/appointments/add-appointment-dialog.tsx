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
import {
  createAppointmentAction,
  getNextVisitSuggestionAction,
  searchPatientsForAppointmentAction,
  type PatientPickerResult,
} from "@/app/(app)/appointments/actions";

interface SelectedPatient {
  id: string;
  fullName: string;
  patientNumber: string;
  pregnancyId: string;
}

interface AddAppointmentDialogProps {
  /** Pass when opened from a patient's own profile — skips the search step. */
  initialPatient?: SelectedPatient;
  /** Button label/variant for the trigger this component renders itself. */
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  onCreated?: () => void;
}

export function AddAppointmentDialog({
  initialPatient,
  triggerLabel = "Add appointment",
  triggerVariant = "default",
  onCreated,
}: AddAppointmentDialogProps) {
  const [open, setOpen] = useState(false);
  // Bumped only when the dialog opens, never on close, and used as the
  // form's `key` below — remounting a fresh form instance is the
  // React-idiomatic way to reset several independent pieces of state at
  // once (rather than an effect imperatively resetting each one, which
  // both fights the framework and reads as a cascading-render smell to
  // the linter). Not bumping on close lets the closing animation finish
  // showing whatever was last there, instead of visibly resetting mid-fade.
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
      <DialogContent>
        <AddAppointmentForm
          key={sessionId}
          initialPatient={initialPatient}
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

function AddAppointmentForm({
  initialPatient,
  onClose,
  onCreated,
}: {
  initialPatient?: SelectedPatient;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const [patient, setPatient] = useState<SelectedPatient | undefined>(initialPatient);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientPickerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [visitNumber, setVisitNumber] = useState("");
  const [appointmentType, setAppointmentType] = useState("ANC Visit");
  const [dateTime, setDateTime] = useState("");
  const [suggestionNote, setSuggestionNote] = useState<string | undefined>();
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!patient) return;
    let cancelled = false;
    getNextVisitSuggestionAction(patient.pregnancyId).then((suggestion) => {
      if (cancelled) return;
      if (suggestion.visitNumber) {
        setVisitNumber(String(suggestion.visitNumber));
        setAppointmentType("ANC Visit");
      }
      if (suggestion.suggestedDate) {
        setDateTime(`${suggestion.suggestedDate}T09:00`);
      }
      setSuggestionNote(suggestion.reasonNoSuggestion ?? undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [patient]);

  function handleQueryChange(next: string) {
    setQuery(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchPatientsForAppointmentAction(next);
      setResults(found);
      setSearching(false);
    }, 300);
  }

  function submit() {
    if (!patient) return;
    setError(undefined);
    startTransition(async () => {
      const result = await createAppointmentAction({
        patient_id: patient.id,
        pregnancy_id: patient.pregnancyId,
        visit_number: visitNumber,
        appointment_type: appointmentType,
        scheduled_date_local: dateTime,
        notes,
      });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      toast.success("Appointment scheduled.");
      onCreated();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{patient ? "Schedule appointment" : "Find a patient"}</DialogTitle>
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
        <div className="flex flex-col gap-4">
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
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="appointment-type">Type</Label>
              <Input
                id="appointment-type"
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="scheduled-date">Date &amp; time</Label>
            <Input
              id="scheduled-date"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
            />
            {suggestionNote ? (
              <p className="text-xs text-muted-foreground">{suggestionNote}</p>
            ) : dateTime ? (
              <p className="text-xs text-muted-foreground">
                Suggested from the configured ANC schedule and this pregnancy&apos;s LMP —
                adjust as needed.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="appointment-notes">Notes</Label>
            <Textarea
              id="appointment-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
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
          <Button onClick={submit} disabled={pending || !dateTime || !appointmentType.trim()}>
            {pending ? "Scheduling…" : "Schedule"}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
