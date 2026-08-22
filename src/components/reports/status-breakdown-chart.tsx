"use client";

import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { ChartContainer } from "@/components/reports/chart-container";
import type { AppointmentStatus } from "@/types/database";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  missed: "Missed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "var(--info)",
  completed: "var(--success)",
  missed: "var(--destructive)",
  cancelled: "var(--muted-foreground)",
  rescheduled: "var(--warning)",
};

/** Donut, not a bare pie — the center gap leaves room for the legend below to carry the text label every slice needs anyway (never color alone). */
export function StatusBreakdownChart({
  data,
}: {
  data: Array<{ status: AppointmentStatus; count: number }>;
}) {
  const nonZero = data.filter((d) => d.count > 0);

  if (nonZero.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No appointments in this range yet.
      </div>
    );
  }

  return (
    <ChartContainer height={288}>
      {({ width, height }) => (
        <PieChart width={width} height={height}>
          <Pie
            data={nonZero}
            dataKey="count"
            nameKey="status"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {nonZero.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
            ))}
          </Pie>
          <Tooltip
            // recharts' Formatter generic can't be satisfied with a plain
            // arrow function typed against our actual payload shape — cast
            // through `never` rather than fight its inference here.
            formatter={((value: number, _name: unknown, item: { payload: { status: AppointmentStatus } }) => [
              value,
              STATUS_LABELS[item.payload.status],
            ]) as never}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(_value, entry) => {
              const status = (entry.payload as unknown as { status: AppointmentStatus }).status;
              return <span className="text-xs">{STATUS_LABELS[status]}</span>;
            }}
          />
        </PieChart>
      )}
    </ChartContainer>
  );
}
