"use client";

import dynamic from "next/dynamic";
import type { ScoreChartPoint } from "./CheckInScoreTrendChart";

const CheckInScoreTrendChart = dynamic(
  () => import("./CheckInScoreTrendChart").then((m) => ({ default: m.CheckInScoreTrendChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] w-full animate-pulse rounded-lg bg-[var(--color-bg-elevated)]" />
    ),
  }
);

export type { ScoreChartPoint };

interface Props {
  data: ScoreChartPoint[];
  redMax?: number;
  orangeMax?: number;
  height?: number;
}

export function CheckInScoreTrendChartLazy(props: Props) {
  return <CheckInScoreTrendChart {...props} />;
}
