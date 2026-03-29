"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceArea,
} from "recharts";
import { formatDateDisplay } from "@/lib/format-date";

export interface CheckInProgressPoint {
  weekKey: string;
  label: string;
  /** null = no check-in that week (line will break) */
  value: number | null;
}

interface CheckInProgressChartProps {
  data: CheckInProgressPoint[];
  /** Client-specific: score &lt;= redMax is red. */
  redMax: number;
  /** Client-specific: redMax &lt; score &lt;= orangeMax is orange, above is green. */
  orangeMax: number;
  height?: number;
}

/**
 * Line chart of weekly check-in % with traffic-light bands (client-specific ranges).
 * Clients see their trend and which zone they're in each week.
 */
export function CheckInProgressChart({
  data,
  redMax,
  orangeMax,
  height = 160,
}: CheckInProgressChartProps) {
  const hasAnyScore = data.some((d) => d.value != null);
  if (data.length === 0 || !hasAnyScore) return null;

  const formatDate = (d: string) => formatDateDisplay(d);

  return (
    <div style={{ width: "100%", minWidth: 200, height, minHeight: height }} className="overflow-visible">
      <ResponsiveContainer width="100%" height={height} minHeight={Math.max(120, height)}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          {/* Traffic-light bands (behind the line): client-specific ranges */}
          <ReferenceArea
            y1={0}
            y2={redMax}
            fill="rgba(239, 68, 68, 0.12)"
            strokeOpacity={0}
          />
          <ReferenceArea
            y1={redMax}
            y2={orangeMax}
            fill="rgba(245, 158, 11, 0.12)"
            strokeOpacity={0}
          />
          <ReferenceArea
            y1={orangeMax}
            y2={100}
            fill="rgba(34, 197, 94, 0.12)"
            strokeOpacity={0}
          />
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="weekKey"
            tickFormatter={(key) => formatDate(key)}
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 10 }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            width={28}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}
            labelStyle={{ color: "var(--color-text)" }}
            formatter={(value: unknown) => {
              const n = Array.isArray(value) ? value[0] : value;
              return typeof n === "number"
                ? [`${n}%`, "Score"]
                : ["No check-in", ""];
            }}
            labelFormatter={(key) => (key ? formatDate(key) : "")}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-primary)"
            strokeWidth={2}
            connectNulls={false}
            dot={(props) => {
              const { value, cx, cy } = props;
              if (value == null || cx == null || cy == null) return null;
              return (
                <circle
                  cx={Number(cx)}
                  cy={Number(cy)}
                  r={3}
                  fill="var(--color-bg-elevated)"
                  stroke="var(--color-primary)"
                />
              );
            }}
            activeDot={(props) => {
              const { value, cx, cy } = props;
              if (value == null) return null;
              return (
                <circle
                  cx={Number(cx)}
                  cy={Number(cy)}
                  r={4}
                  fill="var(--color-bg-elevated)"
                  stroke="var(--color-primary)"
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
