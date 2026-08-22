import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** e.g. "+3 this week" — plain text, never the only signal (no color-only deltas). */
  note?: string;
  tone?: "default" | "success" | "warning" | "destructive";
  className?: string;
}

const TONE_ICON_CLASSES: Record<Required<MetricCardProps>["tone"], string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

/** The dashboard KPI tile used throughout section 12 of the build spec. */
export function MetricCard({
  label,
  value,
  icon: Icon,
  note,
  tone = "default",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon ? (
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              TONE_ICON_CLASSES[tone],
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <span className="text-[28px] font-bold leading-none tracking-tight">
        {value}
      </span>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </div>
  );
}
