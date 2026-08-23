"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REPORT_RANGE_PRESETS } from "@/lib/reportRange";

/**
 * URL-param-driven date range picker shared by every report-style tab
 * (preset dropdown + custom start/end when "Custom range" is chosen).
 * Preserves whatever other params are already on the URL (e.g. `type`).
 * `presets`/`defaultPreset`/`defaultLabel` let a caller offer a
 * different preset list — the Audit Log viewer adds an "All time"
 * entry and defaults to it, since (unlike a Reports page) there's no
 * reason an audit trail should default to hiding everything older than
 * 30 days.
 */
export function DateRangeFilter({
  presets = REPORT_RANGE_PRESETS,
  defaultPreset = "30d",
  defaultLabel = "Last 30 days",
}: {
  presets?: Array<{ value: string; label: string }>;
  defaultPreset?: string;
  defaultLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preset = searchParams.get("preset") ?? defaultPreset;

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label className="text-xs">Date range</Label>
        <Select
          value={preset}
          onValueChange={(value) => updateParams({ preset: value === defaultPreset ? null : value })}
        >
          <SelectTrigger className="w-44">
            <SelectValue>
              {(value: string) => presets.find((o) => o.value === value)?.label ?? defaultLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {presets.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {preset === "custom" ? (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="range-start" className="text-xs">
              From
            </Label>
            <Input
              id="range-start"
              type="date"
              className="w-40"
              defaultValue={searchParams.get("start") ?? ""}
              onChange={(e) => updateParams({ start: e.target.value || null })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="range-end" className="text-xs">
              To
            </Label>
            <Input
              id="range-end"
              type="date"
              className="w-40"
              defaultValue={searchParams.get("end") ?? ""}
              onChange={(e) => updateParams({ end: e.target.value || null })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
