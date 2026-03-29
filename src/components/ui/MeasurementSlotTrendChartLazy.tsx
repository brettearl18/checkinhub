"use client";

import dynamic from "next/dynamic";
import type { SlotChartRow } from "./MeasurementSlotTrendChart";

const MeasurementSlotTrendChart = dynamic(
  () => import("./MeasurementSlotTrendChart").then((m) => ({ default: m.MeasurementSlotTrendChart })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[200px] w-full animate-pulse rounded-lg bg-[var(--color-bg-elevated)]" />
    ),
  }
);

export type { SlotChartRow };

interface Props {
  rows: SlotChartRow[];
  unit: string;
  height?: number;
}

export function MeasurementSlotTrendChartLazy(props: Props) {
  return <MeasurementSlotTrendChart {...props} />;
}
