"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AuditEntityTypeFilter({ entityTypes }: { entityTypes: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("entityType") ?? "all";

  function update(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete("entityType");
    else params.set("entityType", value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">Record type</Label>
      <Select value={current} onValueChange={update}>
        <SelectTrigger className="w-48">
          <SelectValue>
            {(value: string) => (value === "all" ? "All record types" : titleCase(value))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All record types</SelectItem>
          {entityTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {titleCase(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
