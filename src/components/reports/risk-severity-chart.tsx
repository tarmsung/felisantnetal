"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { ChartContainer } from "@/components/reports/chart-container";
import type { RiskSeverity } from "@/types/database";

const SEVERITY_LABELS: Record<RiskSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

// Matches SeverityBadge's tone mapping (low->info, medium->warning, high/critical->destructive) so the chart and the badges never disagree.
const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  low: "var(--info)",
  medium: "var(--warning)",
  high: "var(--destructive)",
  critical: "var(--destructive)",
};

export function RiskSeverityChart({ data }: { data: Array<{ severity: RiskSeverity; count: number }> }) {
  const chartData = data.map((d) => ({ ...d, label: SEVERITY_LABELS[d.severity] }));

  return (
    <ChartContainer height={288}>
      {({ width, height }) => (
        <BarChart
          width={width}
          height={height}
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" width={70} />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" name="Active flags" radius={[0, 3, 3, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity]} />
            ))}
          </Bar>
        </BarChart>
      )}
    </ChartContainer>
  );
}
