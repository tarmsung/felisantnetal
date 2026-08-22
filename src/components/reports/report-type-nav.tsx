"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const REPORT_TYPES: { key: string; label: string }[] = [
  { key: "attendance", label: "Attendance" },
  { key: "missed", label: "Missed Visits" },
  { key: "high-risk", label: "High Risk" },
  { key: "patients", label: "Patient Summary" },
];

/** Switches which report is shown while preserving the current date-range params — same URL-param-driven pattern as calendar-nav.tsx's view switcher. */
export function ReportTypeNav({ activeType }: { activeType: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(type: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", type);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
      {REPORT_TYPES.map((t) => (
        <Button
          key={t.key}
          size="sm"
          variant={t.key === activeType ? "default" : "ghost"}
          onClick={() => go(t.key)}
        >
          {t.label}
        </Button>
      ))}
    </div>
  );
}

export { REPORT_TYPES };
