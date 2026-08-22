"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ChartContainer } from "@/components/reports/chart-container";

export function RegistrationTrendChart({ data }: { data: Array<{ label: string; count: number }> }) {
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
          <Bar dataKey="count" name="New registrations" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
        </BarChart>
      )}
    </ChartContainer>
  );
}
