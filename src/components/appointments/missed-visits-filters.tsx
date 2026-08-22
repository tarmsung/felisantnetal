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

const RISK_OPTIONS = [
  { value: "all", label: "Any risk status" },
  { value: "high_risk", label: "High risk" },
  { value: "normal", label: "Normal" },
];

export function MissedVisitsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="min-days-overdue" className="text-xs">
          Minimum days overdue
        </Label>
        <Input
          id="min-days-overdue"
          type="number"
          min={0}
          className="w-40"
          defaultValue={searchParams.get("minDays") ?? ""}
          onChange={(e) => updateParam("minDays", e.target.value)}
          placeholder="Any"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Risk status</Label>
        <Select
          value={searchParams.get("risk") ?? "all"}
          onValueChange={(value) => updateParam("risk", value)}
        >
          <SelectTrigger className="w-44">
            <SelectValue>
              {(value: string) => RISK_OPTIONS.find((o) => o.value === value)?.label ?? "Any risk status"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RISK_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
