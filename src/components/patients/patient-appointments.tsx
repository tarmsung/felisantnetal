"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { AppointmentDetailSheet } from "@/components/appointments/appointment-detail-sheet";
import { AddAppointmentDialog } from "@/components/appointments/add-appointment-dialog";
import { formatClinicDateTime } from "@/lib/dates";
import type { AppointmentListRow } from "@/lib/services/appointmentService";

export function PatientAppointments({
  patientId,
  pregnancyId,
  patientName,
  patientNumber,
  appointments,
}: {
  patientId: string;
  pregnancyId: string | null;
  patientName: string;
  patientNumber: string;
  appointments: AppointmentListRow[];
}) {
  const router = useRouter();
  // See appointment-calendar.tsx's comment — derived by id from the
  // (server-refreshed) `appointments` prop, not a stored copy.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        {pregnancyId ? (
          <AddAppointmentDialog
            initialPatient={{
              id: patientId,
              fullName: patientName,
              patientNumber,
              pregnancyId,
            }}
            onCreated={() => router.refresh()}
          />
        ) : null}
      </div>

      {appointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No appointments yet"
          description="Schedule this patient's next ANC visit to get started."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {appointments.map((appointment) => (
            <li key={appointment.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(appointment.id);
                  setOpen(true);
                }}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/50"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {appointment.visit_number ? `Visit ${appointment.visit_number}` : appointment.appointment_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatClinicDateTime(appointment.scheduled_date)}
                  </span>
                </div>
                <AppointmentStatusBadge status={appointment.status} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AppointmentDetailSheet
        appointment={selected}
        open={open}
        onOpenChange={setOpen}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}
