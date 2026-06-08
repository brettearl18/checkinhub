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
  ReferenceArea,
  ReferenceLine,
} from "recharts";

const BAND_RED = "rgba(239, 68, 68, 0.14)";
const BAND_ORANGE = "rgba(245, 158, 11, 0.14)";
const BAND_GREEN = "rgba(34, 197, 94, 0.14)";
import { formatDateDisplay } from "@/lib/format-date";

export interface ScoreChartPoint {
  date: string;
  score: number;
  label?: string;
}

interface Props {
  data: ScoreChartPoint[];
  redMax?: number;
  orangeMax?: number;
  height?: number;
}

export function CheckInScoreTrendChart({
  data,
  redMax = 40,
  orangeMax = 70,
  height = 220,
}: Props) {
  const gradientId = useId().replace(/:/g, "");

  const chronological = useMemo(
    () => [...data].sort((a, b) => a.date.localeCompare(b.date)),
    [data]
  );

  if (chronological.length === 0) return null;

  const xStart = chronological[0]!.date;
  const xEnd = chronological[chronological.length - 1]!.date;

  return (
    <div className="w-full overflow-visible">
      <ResponsiveContainer width="100%" height={height} minHeight={Math.max(120, height)}>
        <AreaChart data={chronological} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <ReferenceArea x1={xStart} x2={xEnd} y1={0} y2={redMax} fill={BAND_RED} ifOverflow="extendDomain" />
          <ReferenceArea
            x1={xStart}
            x2={xEnd}
            y1={redMax}
            y2={orangeMax}
            fill={BAND_ORANGE}
            ifOverflow="extendDomain"
          />
          <ReferenceArea
            x1={xStart}
            x2={xEnd}
            y1={orangeMax}
            y2={100}
            fill={BAND_GREEN}
            ifOverflow="extendDomain"
          />
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <ReferenceLine y={redMax} stroke="rgba(239, 68, 68, 0.5)" strokeDasharray="4 4" />
          <ReferenceLine y={orangeMax} stroke="rgba(245, 158, 11, 0.6)" strokeDasharray="4 4" />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => formatDateDisplay(d)}
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            stroke="var(--color-text-muted)"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}
            labelStyle={{ color: "var(--color-text)" }}
            formatter={(value: unknown) => [`${typeof value === "number" ? value : 0}%`, "Score"]}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload as ScoreChartPoint | undefined;
              const dateLabel = label ? formatDateDisplay(String(label)) : "";
              return row?.label ? `${dateLabel} · ${row.label}` : dateLabel;
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, fill: "var(--color-bg-elevated)", stroke: "var(--color-primary)" }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm" style={{ background: BAND_RED, border: "1px solid rgba(239,68,68,0.35)" }} />
          Needs attention (0–{redMax}%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm" style={{ background: BAND_ORANGE, border: "1px solid rgba(245,158,11,0.4)" }} />
          Moderate ({redMax + 1}–{orangeMax}%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm" style={{ background: BAND_GREEN, border: "1px solid rgba(34,197,94,0.35)" }} />
          Good ({orangeMax + 1}–100%)
        </span>
      </div>
    </div>
  );
}
