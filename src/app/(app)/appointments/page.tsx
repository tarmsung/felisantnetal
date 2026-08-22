import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listAppointmentsForRange } from "@/lib/services/appointmentService";
import { getRangeForView, todayKey, type CalendarView } from "@/lib/calendar";
import { getMonthRange, getWeekRange } from "@/lib/calendar";
import { AppointmentCalendar } from "@/components/calendar/appointment-calendar";

export const metadata: Metadata = { title: "Appointments" };

function parseView(value: string | undefined): CalendarView {
  return value === "day" || value === "week" ? value : "month";
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  await requireUser();
  const { view: viewParam, date: dateParam } = await searchParams;
  const view = parseView(viewParam);
  const dateKey = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayKey();

  const { startIso, endIso } = getRangeForView(view, dateKey);
  const appointments = await listAppointmentsForRange(startIso, endIso);

  const weeks = view === "month" ? getMonthRange(dateKey).weeks : undefined;
  const weekDays = view === "week" ? getWeekRange(dateKey).days : undefined;

  return (
    <AppointmentCalendar
      view={view}
      dateKey={dateKey}
      appointments={appointments}
      weeks={weeks}
      weekDays={weekDays}
    />
  );
}
