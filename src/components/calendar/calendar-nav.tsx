"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shiftDateKey, todayKey, type CalendarView } from "@/lib/calendar";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export function CalendarNav({
  view,
  dateKey,
  periodLabel,
}: {
  view: CalendarView;
  dateKey: string;
  periodLabel: string;
}) {
  const router = useRouter();

  function go(nextView: CalendarView, nextDate: string) {
    router.push(`/appointments?view=${nextView}&date=${nextDate}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous"
          onClick={() => go(view, shiftDateKey(dateKey, view, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => go(view, todayKey())}>
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next"
          onClick={() => go(view, shiftDateKey(dateKey, view, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 text-sm font-semibold">{periodLabel}</span>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        {VIEWS.map((v) => (
          <Button
            key={v.key}
            size="sm"
            variant={v.key === view ? "default" : "ghost"}
            onClick={() => go(v.key, dateKey)}
          >
            {v.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
