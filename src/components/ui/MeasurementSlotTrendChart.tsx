"use client";

import { useId, useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { formatDateDisplay } from "@/lib/format-date";
import { MEASUREMENT_SLOT_COUNT } from "./measurement-slot-constants";

export { MEASUREMENT_SLOT_COUNT };

export interface SlotChartRow {
  slot: number;
  value: number | null;
  date: string | null;
}

interface MeasurementSlotTrendChartProps {
  /** Up to 20 points, chronological order within the selected range. */
  rows: SlotChartRow[];
  unit: string;
  color?: string;
  height?: number;
}

const PADDING_KG = 5;
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

/**
 * Coach progress: fixed 20 X positions. Measurements fill slots 0,1,2… in order (not stretched by calendar gap).
 */
export function MeasurementSlotTrendChart({
  rows,
  unit,
  color = "var(--color-primary)",
  height = 260,
}: MeasurementSlotTrendChartProps) {
  const gradientId = useId().replace(/:/g, "");

  const { domain, ticks } = useMemo(() => {
    const values = rows.map((r) => r.value).filter((v): v is number => v != null);
    if (values.length === 0) return { domain: [0, 10] as [number, number], ticks: [0, 5, 10] };
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const padding = unit === "kg" ? PADDING_KG : PADDING_CM;
    const domainMin = dataMin - padding;
    const domainMax = dataMax + padding;
    const domain: [number, number] = [domainMin, domainMax];
    const tickList = niceTicks(domainMin, domainMax);
    return { domain, ticks: tickList };
  }, [rows, unit]);

  const hasData = rows.some((r) => r.value != null);
  if (!hasData) return null;

  return (
    <div style={{ width: "100%", minWidth: 200, height, minHeight: Math.max(100, height) }} className="overflow-visible">
      <ResponsiveContainer width="100%" height={height} minHeight={Math.max(100, height)}>
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            type="number"
            dataKey="slot"
            domain={[0, MEASUREMENT_SLOT_COUNT - 1]}
            ticks={[0, 4, 8, 12, 16, 19]}
            tickFormatter={(s) => (Number.isInteger(s) ? `${s + 1}` : "")}
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
            label={{ value: "Reading # (1–20)", position: "bottom", offset: 0, fill: "var(--color-text-muted)", fontSize: 11 }}
          />
          <YAxis
            domain={domain}
            ticks={ticks}
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}${unit ? ` ${unit}` : ""}`}
            width={48}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}
            labelStyle={{ color: "var(--color-text)" }}
            formatter={(value: unknown) => {
              const n = typeof value === "number" ? value : null;
              return n != null ? [`${n} ${unit}`, "Value"] : ["—", ""];
            }}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as SlotChartRow | undefined;
              if (row?.date) return `${formatDateDisplay(row.date)} · #${row.slot + 1}`;
              return `Slot ${row != null ? row.slot + 1 : ""}`;
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            connectNulls={false}
            dot={{ r: 3, fill: "var(--color-bg-elevated)", stroke: color }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
