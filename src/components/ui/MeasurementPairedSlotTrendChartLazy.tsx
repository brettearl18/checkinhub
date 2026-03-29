"use client";

import {
  MeasurementPairedSlotTrendChart,
  type PairedSlotChartRow,
} from "./MeasurementPairedSlotTrendChart";

export type { PairedSlotChartRow };

interface Props {
  rows: PairedSlotChartRow[];
  unit: string;
  leftLabel: string;
  rightLabel: string;
  height?: number;
}

/** Direct import avoids Turbopack/async chunk failures from nested dynamic() + recharts. */
export function MeasurementPairedSlotTrendChartLazy(props: Props) {
  return <MeasurementPairedSlotTrendChart {...props} />;
}
