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

/** URL-param-driven date range picker shared by every report tab (preset dropdown + custom start/end when "Custom range" is chosen). Preserves whatever other params are already on the URL (e.g. `type`). */
export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preset = searchParams.get("preset") ?? "30d";

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
        <Select value={preset} onValueChange={(value) => updateParams({ preset: value })}>
          <SelectTrigger className="w-44">
            <SelectValue>
              {(value: string) => REPORT_RANGE_PRESETS.find((o) => o.value === value)?.label ?? "Last 30 days"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {REPORT_RANGE_PRESETS.map((option) => (
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
