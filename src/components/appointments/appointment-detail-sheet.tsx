"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Phone, StickyNote, XCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { RiskBadge } from "@/components/shared/risk-badge";
import { RescheduleDialog } from "@/components/appointments/reschedule-dialog";
import { CancelDialog } from "@/components/appointments/cancel-dialog";
import { AddNoteDialog } from "@/components/appointments/add-note-dialog";
import {
  completeAppointmentAction,
  markAppointmentMissedAction,
} from "@/app/(app)/appointments/actions";
import { formatClinicDateTime } from "@/lib/dates";
import type { AppointmentListRow } from "@/lib/services/appointmentService";

export function AppointmentDetailSheet({
  appointment,
  open,
  onOpenChange,
  onChanged,
}: {
  appointment: AppointmentListRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"reschedule" | "cancel" | "note" | null>(null);

  if (!appointment) return null;

  // Spec section 13 explicitly lists "Mark completed, Reschedule,
  // Contact patient, Add note" as actions on a *missed* appointment —
  // a missed visit isn't a dead end, it's exactly the case the Missed
  // Visits page exists to help a nurse resolve. Only "Mark missed"
  // itself doesn't make sense to offer again once already missed.
  const canResolve = appointment.status === "scheduled" || appointment.status === "missed";
  const canMarkMissed = appointment.status === "scheduled";

  function handleComplete() {
    if (!appointment) return;
    startTransition(async () => {
      const result = await completeAppointmentAction(appointment.id, appointment.patient_id);
      if (result.status === "error") {
        toast.error(result.message ?? "Failed to complete.");
        return;
      }
      toast.success("Marked completed.");
      onChanged?.();
    });
  }

  function handleMarkMissed() {
    if (!appointment) return;
    startTransition(async () => {
      const result = await markAppointmentMissedAction(appointment.id, appointment.patient_id);
      if (result.status === "error") {
        toast.error(result.message ?? "Failed to update.");
        return;
      }
      toast.success("Marked missed.");
      onChanged?.();
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col gap-5 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{appointment.patient_full_name}</SheetTitle>
            <SheetDescription>
              {appointment.patient_number}
              {appointment.visit_number ? ` · Visit ${appointment.visit_number}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3 px-4">
            <div className="flex flex-wrap items-center gap-2">
              <AppointmentStatusBadge status={appointment.status} />
              <RiskBadge status={appointment.patient_risk_status} />
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{appointment.appointment_type}</dd>
              <dt className="text-muted-foreground">Scheduled</dt>
              <dd>{formatClinicDateTime(appointment.scheduled_date)}</dd>
              {appointment.patient_phone ? (
                <>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{appointment.patient_phone}</dd>
                </>
              ) : null}
              {appointment.reschedule_reason ? (
                <>
                  <dt className="text-muted-foreground">Reschedule reason</dt>
                  <dd>{appointment.reschedule_reason}</dd>
                </>
              ) : null}
              {appointment.cancellation_reason ? (
                <>
                  <dt className="text-muted-foreground">Cancellation reason</dt>
                  <dd>{appointment.cancellation_reason}</dd>
                </>
              ) : null}
            </dl>

            {appointment.notes ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes
                </p>
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-foreground/80">
                  {appointment.notes}
                </pre>
              </div>
            ) : null}

            <Button
              render={<Link href={`/patients/${appointment.patient_id}`} />}
              nativeButton={false}
              variant="link"
              className="h-auto justify-start px-0"
            >
              View patient profile →
            </Button>
          </div>

          <SheetFooter className="mt-auto flex-col gap-2 sm:flex-col">
            {canResolve ? (
              <>
                <Button onClick={handleComplete} disabled={pending}>
                  <CheckCircle2 className="h-4 w-4" />
                  Mark completed
                </Button>
                <Button variant="outline" onClick={() => setDialog("reschedule")} disabled={pending}>
                  <CalendarClock className="h-4 w-4" />
                  Reschedule
                </Button>
                {canMarkMissed ? (
                  <Button variant="outline" onClick={handleMarkMissed} disabled={pending}>
                    <XCircle className="h-4 w-4" />
                    Mark missed
                  </Button>
                ) : null}
                <Button variant="destructive" onClick={() => setDialog("cancel")} disabled={pending}>
                  Cancel appointment
                </Button>
              </>
            ) : null}
            {appointment.patient_phone ? (
              <Button
                variant="outline"
                render={<a href={`tel:${appointment.patient_phone}`} />}
                nativeButton={false}
              >
                <Phone className="h-4 w-4" />
                Call {appointment.patient_full_name.split(" ")[0]}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setDialog("note")} disabled={pending}>
              <StickyNote className="h-4 w-4" />
              Add note
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <RescheduleDialog
        appointmentId={appointment.id}
        patientId={appointment.patient_id}
        currentScheduledDate={appointment.scheduled_date}
        open={dialog === "reschedule"}
        onOpenChange={(o) => setDialog(o ? "reschedule" : null)}
        onDone={() => {
          onOpenChange(false);
          onChanged?.();
        }}
      />
      <CancelDialog
        appointmentId={appointment.id}
        patientId={appointment.patient_id}
        open={dialog === "cancel"}
        onOpenChange={(o) => setDialog(o ? "cancel" : null)}
        onDone={() => {
          onOpenChange(false);
          onChanged?.();
        }}
      />
      <AddNoteDialog
        appointmentId={appointment.id}
        patientId={appointment.patient_id}
        open={dialog === "note"}
        onOpenChange={(o) => setDialog(o ? "note" : null)}
        onDone={() => onChanged?.()}
      />
    </>
  );
}
