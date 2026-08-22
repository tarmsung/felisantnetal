import { cn } from "@/lib/utils";

export type BadgeTone = "default" | "success" | "warning" | "destructive" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  default: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
};

/**
 * Generic status chip used across patients/appointments/risk flags.
 * Always pairs the color with a text label (spec section 8/40: never
 * rely on color alone to convey status) — the dot is a secondary,
 * glanceable signal, not the only one.
 */
export function StatusBadge({
  label,
  tone = "default",
  className,
}: {
  label: string;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])} />
      {label}
    </span>
  );
}
