"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Replaces recharts' own `<ResponsiveContainer>` — found (Phase 6) to
 * sometimes measure its container mid-layout (e.g. before a flex/grid
 * sibling has settled its final width during initial hydration) and
 * never re-measure afterward, since a `ResizeObserver` only fires again
 * on an actual subsequent size *change*, not because the first reading
 * was wrong. The failure mode is nasty precisely because it's silent
 * and non-deterministic: the chart paints at some earlier, incorrect
 * width (confirmed live: a chart measured against an earlier 1280px-wide
 * viewport stayed stuck at that width after navigating to a fresh
 * 800px-wide load), overflowing its card and the page horizontally
 * instead of failing loudly.
 *
 * This does its own measurement directly on a plain wrapper div via
 * `ResizeObserver`, renders nothing until the first real measurement
 * lands (avoiding an initial 0-width chart flash), and hands the
 * measured pixel size to the caller to pass straight into recharts'
 * chart components (`<BarChart width={width} height={height}>`) —
 * bypassing ResponsiveContainer's internal measurement entirely rather
 * than trying to coax it into re-measuring.
 */
export function ChartContainer({
  height = 288,
  children,
}: {
  height?: number;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", height }}>
      {width > 0 ? children({ width, height }) : null}
    </div>
  );
}
