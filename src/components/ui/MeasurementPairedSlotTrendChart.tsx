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
import {
  maxFilledSlot,
  slotChartXAxis,
  slotChartYDomain,
} from "./measurement-slot-chart-utils";

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
  /** Short name for X-axis and tooltips, e.g. "Thigh" or "Arm". */
  seriesLabel?: string;
  leftColor?: string;
  rightColor?: string;
  height?: number;
  /** When true, chart fills its parent (e.g. grid cell) instead of capping at 420px. */
  fillContainer?: boolean;
}

/** Each slot is a calendar date with at least one side logged (left / right series). */
export function MeasurementPairedSlotTrendChart({
  rows,
  unit,
  leftLabel,
  rightLabel,
  seriesLabel = "Measurement",
  leftColor = "var(--color-primary)",
  rightColor = "var(--color-warning)",
  height = 260,
  fillContainer = false,
}: Props) {
  const gradL = useId().replace(/:/g, "");
  const gradR = useId().replace(/:/g, "");

  const filledRows = useMemo(
    () => rows.filter((r) => r.left != null || r.right != null),
    [rows]
  );

  const { domain, ticks } = useMemo(() => {
    const values = filledRows.flatMap((r) => [r.left, r.right]).filter((v): v is number => v != null);
    return slotChartYDomain(values, unit);
  }, [filledRows, unit]);

  const xAxis = useMemo(
    () => slotChartXAxis(maxFilledSlot(rows), seriesLabel),
    [rows, seriesLabel]
  );

  const hasData = filledRows.length > 0;
  if (!hasData) return null;

  const chartHeight = fillContainer ? "100%" : height;
  const chartMinHeight = fillContainer ? undefined : Math.max(100, height);

  const chart = (
    <ResponsiveContainer width="100%" height={chartHeight} minHeight={chartMinHeight}>
        <AreaChart data={filledRows} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
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
            domain={xAxis.domain}
            ticks={xAxis.ticks}
            tickFormatter={(s) => (Number.isInteger(s) ? `${s + 1}` : "")}
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
            label={{
              value: xAxis.label,
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
              if (row?.date) {
                return `${formatDateDisplay(row.date)} · ${seriesLabel} #${row.slot + 1}`;
              }
              return `${seriesLabel} #${row != null ? row.slot + 1 : ""}`;
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
  );

  const legend = (
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
  );

  if (fillContainer) {
    return (
      <div className="w-full">
        <div className="aspect-[5/4] w-full overflow-visible">{chart}</div>
        {legend}
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        height,
        minHeight: Math.max(100, height),
      }}
      className="mx-auto overflow-visible"
    >
      {chart}
      {legend}
    </div>
  );
}
