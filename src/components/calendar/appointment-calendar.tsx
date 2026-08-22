"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarNav } from "@/components/calendar/calendar-nav";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import { AppointmentDetailSheet } from "@/components/appointments/appointment-detail-sheet";
import { AddAppointmentDialog } from "@/components/appointments/add-appointment-dialog";
import type { CalendarView } from "@/lib/calendar";
import type { AppointmentListRow } from "@/lib/services/appointmentService";

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function periodLabel(view: CalendarView, dateKey: string, weeks?: string[][], weekDays?: string[]) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (view === "month") return `${MONTH_LABELS[month - 1]} ${year}`;
  if (view === "day") {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return `${WEEKDAY_LABELS[weekday]}, ${day} ${MONTH_LABELS[month - 1]} ${year}`;
  }
  if (weekDays && weekDays.length === 7) {
    const [sy, sm, sd] = weekDays[0].split("-").map(Number);
    const [ey, em, ed] = weekDays[6].split("-").map(Number);
    const startLabel = `${sd} ${MONTH_LABELS[sm - 1]}`;
    const endLabel = sy === ey ? `${ed} ${MONTH_LABELS[em - 1]} ${ey}` : `${ed} ${MONTH_LABELS[em - 1]} ${ey}`;
    return `${startLabel} – ${endLabel}`;
  }
  return dateKey;
}

export function AppointmentCalendar({
  view,
  dateKey,
  appointments,
  weeks,
  weekDays,
}: {
  view: CalendarView;
  dateKey: string;
  appointments: AppointmentListRow[];
  weeks?: string[][];
  weekDays?: string[];
}) {
  const router = useRouter();
  // Holding just the id and deriving the row from the (server-refreshed)
  // `appointments` prop — rather than a copy of the row itself — means
  // an in-sheet action (add note, mark completed, ...) shows up in the
  // still-open sheet immediately after router.refresh() re-renders this
  // page with fresh data, with no extra effect needed to keep a second
  // copy in sync.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  function handleSelect(appointment: AppointmentListRow) {
    setSelectedId(appointment.id);
    setSheetOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CalendarNav
          view={view}
          dateKey={dateKey}
          periodLabel={periodLabel(view, dateKey, weeks, weekDays)}
        />
        <AddAppointmentDialog onCreated={refresh} />
      </div>

      {view === "month" && weeks ? (
        <MonthView
          weeks={weeks}
          monthKey={dateKey.slice(0, 7)}
          appointments={appointments}
          onSelect={handleSelect}
        />
      ) : null}
      {view === "week" && weekDays ? (
        <WeekView days={weekDays} appointments={appointments} onSelect={handleSelect} />
      ) : null}
      {view === "day" ? (
        <DayView appointments={appointments} onSelect={handleSelect} />
      ) : null}

      <AppointmentDetailSheet
        appointment={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onChanged={refresh}
      />
    </div>
  );
}
