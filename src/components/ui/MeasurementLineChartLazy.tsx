"use client";

import dynamic from "next/dynamic";
import type { ChartPoint } from "./MeasurementLineChart";

const MeasurementLineChart = dynamic(
  () => import("./MeasurementLineChart").then((m) => ({ default: m.MeasurementLineChart })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[200px] w-full animate-pulse rounded-lg bg-[var(--color-bg-elevated)]" />
    ),
  }
);

export type { ChartPoint };

interface MeasurementLineChartLazyProps {
  data: ChartPoint[];
  unit: string;
  color?: string;
  height?: number;
}

/** Lazy-loaded MeasurementLineChart (Recharts) so chart pages don’t bloat the initial bundle. */
export function MeasurementLineChartLazy(props: MeasurementLineChartLazyProps) {
  return <MeasurementLineChart {...props} />;
}
