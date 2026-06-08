"use client";

import dynamic from "next/dynamic";
import type { SlotChartRow } from "./MeasurementSlotTrendChart";

const MeasurementSlotTrendChart = dynamic(
  () => import("./MeasurementSlotTrendChart").then((m) => ({ default: m.MeasurementSlotTrendChart })),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-[5/4] w-full animate-pulse rounded-lg bg-[var(--color-bg-elevated)]" />
    ),
  }
);

export type { SlotChartRow };

interface Props {
  rows: SlotChartRow[];
  unit: string;
  seriesLabel?: string;
  height?: number;
  fillContainer?: boolean;
}

export function MeasurementSlotTrendChartLazy(props: Props) {
  return <MeasurementSlotTrendChart {...props} />;
}
