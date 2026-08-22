"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ChartContainer } from "@/components/reports/chart-container";
import type { AttendanceTrendPoint } from "@/lib/services/reportService";

/** Grouped bars per period — completed vs missed is the pair that matters most for spotting an attendance problem; scheduled/cancelled/rescheduled ride along for context. */
export function AttendanceTrendChart({ data }: { data: AttendanceTrendPoint[] }) {
  return (
    <ChartContainer height={288}>
      {({ width, height }) => (
        <BarChart width={width} height={height} data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="completed" name="Completed" fill="var(--success)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="missed" name="Missed" fill="var(--destructive)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="scheduled" name="Scheduled" fill="var(--info)" radius={[3, 3, 0, 0]} />
        </BarChart>
      )}
    </ChartContainer>
  );
}
