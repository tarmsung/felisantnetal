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
import { rescheduleAppointmentAction } from "@/app/(app)/appointments/actions";
import { isoToClinicDateTimeLocal } from "@/lib/dates";

export function RescheduleDialog({
  appointmentId,
  patientId,
  currentScheduledDate,
  open,
  onOpenChange,
  onDone,
}: {
  appointmentId: string;
  patientId: string;
  currentScheduledDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [newDate, setNewDate] = useState(isoToClinicDateTimeLocal(currentScheduledDate));
  const [reason, setReason] = useState("");

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await rescheduleAppointmentAction(appointmentId, patientId, {
        new_scheduled_date_local: newDate,
        reason,
      });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      toast.success("Appointment rescheduled.");
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
          <DialogDescription>
            The original scheduled date stays on record — this creates a new
            appointment linked back to it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="new-date">New date &amp; time</Label>
            <Input
              id="new-date"
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reschedule-reason">Reason</Label>
            <Textarea
              id="reschedule-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Patient requested a later time"
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
          <Button onClick={submit} disabled={pending || !newDate || !reason.trim()}>
            {pending ? "Saving…" : "Reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
