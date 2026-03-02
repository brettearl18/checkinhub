"use client";

import { useId } from "react";
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

export interface ChartPoint {
  date: string;
  value: number;
  label?: string;
}

interface MeasurementLineChartProps {
  data: ChartPoint[];
  unit: string;
  color?: string;
  height?: number;
}

export function MeasurementLineChart({
  data,
  unit,
  color = "var(--color-primary)",
  height = 260,
}: MeasurementLineChartProps) {
  const gradientId = useId().replace(/:/g, "");

  if (data.length === 0) return null;

  const formatDate = (d: string) => formatDateDisplay(d);

  return (
    <div style={{ width: "100%", height }} className="min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}${unit ? ` ${unit}` : ""}`}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}
            labelStyle={{ color: "var(--color-text)" }}
            formatter={(value: number) => [`${value} ${unit}`, ""]}
            labelFormatter={(label) => (label ? formatDateDisplay(label) : "")}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
