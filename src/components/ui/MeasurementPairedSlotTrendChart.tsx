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

export interface PairedSlotChartRow {
  slot: number;
  date: string | null;
  left: number | null;
  right: number | null;
}

interface Props {
  rows: PairedSlotChartRow[];
  unit: string;
  leftLabel: string;
  rightLabel: string;
  leftColor?: string;
  rightColor?: string;
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

/** Fixed 20 slots; each slot is a calendar date with at least one side logged (left / right series). */
export function MeasurementPairedSlotTrendChart({
  rows,
  unit,
  leftLabel,
  rightLabel,
  leftColor = "var(--color-primary)",
  rightColor = "var(--color-warning)",
  height = 260,
}: Props) {
  const gradL = useId().replace(/:/g, "");
  const gradR = useId().replace(/:/g, "");

  const { domain, ticks } = useMemo(() => {
    const values = rows.flatMap((r) => [r.left, r.right]).filter((v): v is number => v != null);
    if (values.length === 0) return { domain: [0, 10] as [number, number], ticks: [0, 5, 10] };
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const domainMin = dataMin - PADDING_CM;
    const domainMax = dataMax + PADDING_CM;
    const domain: [number, number] = [domainMin, domainMax];
    return { domain, ticks: niceTicks(domainMin, domainMax) };
  }, [rows]);

  const hasData = rows.some((r) => r.left != null || r.right != null);
  if (!hasData) return null;

  return (
    <div style={{ width: "100%", minWidth: 200, height, minHeight: Math.max(100, height) }} className="overflow-visible">
      <ResponsiveContainer width="100%" height={height} minHeight={Math.max(100, height)}>
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id={gradL} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={leftColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={leftColor} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={gradR} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={rightColor} stopOpacity={0.22} />
              <stop offset="100%" stopColor={rightColor} stopOpacity={0} />
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
            label={{
              value: "Reading # (1–20)",
              position: "bottom",
              offset: 0,
              fill: "var(--color-text-muted)",
              fontSize: 11,
            }}
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
            formatter={(value: unknown, name?: string) => {
              const n = typeof value === "number" ? value : null;
              const label = name === "left" ? leftLabel : name === "right" ? rightLabel : (name ?? "");
              return n != null ? [`${n} ${unit}`, label] : ["—", label];
            }}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as PairedSlotChartRow | undefined;
              if (row?.date) return `${formatDateDisplay(row.date)} · #${row.slot + 1}`;
              return `Reading #${row != null ? row.slot + 1 : ""}`;
            }}
          />
          <Area
            type="monotone"
            dataKey="left"
            name="left"
            stroke={leftColor}
            strokeWidth={2}
            fill={`url(#${gradL})`}
            connectNulls={false}
            dot={{ r: 3, fill: "var(--color-bg-elevated)", stroke: leftColor }}
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="right"
            name="right"
            stroke={rightColor}
            strokeWidth={2}
            fill={`url(#${gradR})`}
            connectNulls={false}
            dot={{ r: 3, fill: "var(--color-bg-elevated)", stroke: rightColor }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: leftColor }} />
          {leftLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: rightColor }} />
          {rightLabel}
        </span>
      </div>
    </div>
  );
}
