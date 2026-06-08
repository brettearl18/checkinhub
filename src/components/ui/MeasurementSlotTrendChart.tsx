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

export { MEASUREMENT_SLOT_COUNT } from "./measurement-slot-constants";

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
  /** When true, chart fills its parent (e.g. grid cell) instead of capping at 420px. */
  fillContainer?: boolean;
}

/**
 * Coach progress: fixed 20 X positions. Measurements fill slots 0,1,2… in order (not stretched by calendar gap).
 */
export function MeasurementSlotTrendChart({
  rows,
  unit,
  color = "var(--color-primary)",
  height = 260,
  fillContainer = false,
}: MeasurementSlotTrendChartProps) {
  const gradientId = useId().replace(/:/g, "");

  const filledRows = useMemo(
    () => rows.filter((r) => r.value != null),
    [rows]
  );

  const { domain, ticks } = useMemo(() => {
    const values = filledRows.map((r) => r.value as number);
    return slotChartYDomain(values, unit);
  }, [filledRows, unit]);

  const xAxis = useMemo(() => slotChartXAxis(maxFilledSlot(rows)), [rows]);

  const hasData = filledRows.length > 0;
  if (!hasData) return null;

  const chartHeight = fillContainer ? "100%" : height;
  const chartMinHeight = fillContainer ? undefined : Math.max(100, height);

  return (
    <div
      style={
        fillContainer
          ? undefined
          : {
              width: "100%",
              maxWidth: 420,
              height,
              minHeight: Math.max(100, height),
            }
      }
      className={
        fillContainer
          ? "aspect-square w-full overflow-visible"
          : "mx-auto overflow-visible"
      }
    >
      <ResponsiveContainer width="100%" height={chartHeight} minHeight={chartMinHeight}>
        <AreaChart data={filledRows} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
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
