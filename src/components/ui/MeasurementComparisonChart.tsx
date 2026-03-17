"use client";

import { useId, useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { formatDateDisplay } from "@/lib/format-date";

export interface ComparisonSeries {
  dataKey: string;
  name: string;
  color: string;
  /** e.g. "6 4" for dashed line — use for second series so L & R stay visible when values match */
  strokeDasharray?: string;
}

interface MeasurementComparisonChartProps {
  /** One row per date with keys for each series (e.g. { date: "2026-01-01", leftArm: 32, rightArm: 33 }) */
  data: Record<string, number | string | undefined>[];
  series: ComparisonSeries[];
  unit: string;
  height?: number;
}

const PADDING_CM = 5;

function tickStep(range: number): number {
  if (range <= 0) return 1;
  if (range <= 12) return 2;
  if (range <= 25) return 5;
  return 10;
}

function niceTicks(domainMin: number, domainMax: number): number[] {
  const range = domainMax - domainMin;
  const step = tickStep(range);
  const start = Math.floor(domainMin / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= domainMax + step * 0.5; v += step) {
    if (v >= domainMin - 0.001) ticks.push(v);
  }
  if (ticks.length < 2) return [domainMin, domainMax];
  return ticks;
}

export function MeasurementComparisonChart({
  data,
  series,
  unit,
  height = 260,
}: MeasurementComparisonChartProps) {
  const { domain, ticks } = useMemo(() => {
    if (data.length === 0) return { domain: [0, 10] as [number, number], ticks: [0, 5, 10] };
    let dataMin = Infinity;
    let dataMax = -Infinity;
    for (const row of data) {
      for (const s of series) {
        const v = row[s.dataKey];
        if (typeof v === "number") {
          dataMin = Math.min(dataMin, v);
          dataMax = Math.max(dataMax, v);
        }
      }
    }
    if (dataMin === Infinity) return { domain: [0, 10] as [number, number], ticks: [0, 5, 10] };
    const domainMin = dataMin - PADDING_CM;
    const domainMax = dataMax + PADDING_CM;
    return {
      domain: [domainMin, domainMax] as [number, number],
      ticks: niceTicks(domainMin, domainMax),
    };
  }, [data, series]);

  const formatDate = (d: string) => formatDateDisplay(d);

  if (data.length === 0) return null;

  return (
    <div style={{ width: "100%", height }} className="min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
          />
          <YAxis
            domain={domain}
            ticks={ticks}
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v} ${unit}`}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}
            labelStyle={{ color: "var(--color-text)" }}
            labelFormatter={(label) => (label ? formatDateDisplay(label) : "")}
            formatter={(value: number | undefined, name?: string) => [
              value != null ? `${value} ${unit}` : "—",
              series.find((s) => s.dataKey === name)?.name ?? name ?? "",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => series.find((s) => s.dataKey === value)?.name ?? value}
          />
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.dataKey}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.strokeDasharray}
              dot={{ r: 3, fill: s.color }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
