"use client";

import dynamic from "next/dynamic";
import type { ComparisonSeries } from "./MeasurementComparisonChart";

const MeasurementComparisonChart = dynamic(
  () => import("./MeasurementComparisonChart").then((m) => ({ default: m.MeasurementComparisonChart })),
  { ssr: false, loading: () => <div className="min-h-[200px] w-full animate-pulse rounded-lg bg-[var(--color-bg-elevated)]" /> }
);

interface MeasurementComparisonChartLazyProps {
  data: Record<string, number | undefined>[];
  series: ComparisonSeries[];
  unit: string;
  height?: number;
}

export function MeasurementComparisonChartLazy(props: MeasurementComparisonChartLazyProps) {
  return <MeasurementComparisonChart {...props} />;
}
