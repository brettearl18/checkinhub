"use client";

function scoreBand(score: number, redMax: number, orangeMax: number): "red" | "orange" | "green" {
  if (score <= redMax) return "red";
  if (score <= orangeMax) return "orange";
  return "green";
}

const BAND_FILL = {
  red: "#ef4444",
  orange: "#f59e0b",
  green: "#22c55e",
} as const;

const BAND_TRACK = {
  red: "rgba(239, 68, 68, 0.35)",
  orange: "rgba(245, 158, 11, 0.35)",
  green: "rgba(34, 197, 94, 0.35)",
} as const;

interface Props {
  text: string;
  earliest: number;
  latest: number;
  delta: number;
  redMax?: number;
  orangeMax?: number;
}

/** Semi-circle + shift track showing how a question score moved from first to latest week. */
export function QuestionTrendGauge({
  text,
  earliest,
  latest,
  delta,
  redMax = 40,
  orangeMax = 70,
}: Props) {
  const improving = delta > 0;
  const latestBand = scoreBand(latest, redMax, orangeMax);
  const earliestBand = scoreBand(earliest, redMax, orangeMax);

  const cx = 60;
  const cy = 58;
  const r = 44;
  const stroke = 6;

  function pointForScore(score: number) {
    const t = Math.max(0, Math.min(100, score)) / 100;
    const angle = Math.PI * (1 - t);
    return {
      x: cx + r * Math.cos(angle),
      y: cy - r * Math.sin(angle),
    };
  }

  /** Arc along the top semicircle from low% → high% (always the short upper path). */
  function topArcPath(lowScore: number, highScore: number) {
    const low = Math.max(0, Math.min(100, lowScore));
    const high = Math.max(0, Math.min(100, highScore));
    if (low >= high) return "";
    const a = pointForScore(low);
    const b = pointForScore(high);
    return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`;
  }

  const latestPt = pointForScore(latest);
  const earliestPt = pointForScore(earliest);
  const shiftPath = topArcPath(Math.min(earliest, latest), Math.max(earliest, latest));
  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
      <p className="line-clamp-2 text-sm font-medium text-[var(--color-text)]" title={text}>
        {text}
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <svg
          viewBox="0 0 120 68"
          className="mx-auto h-[72px] w-[120px] shrink-0 sm:mx-0"
          role="img"
          aria-label={`Score moved from ${earliest}% to ${latest}%`}
        >
          <path
            d={topArcPath(0, 100)}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={topArcPath(0, redMax)}
            fill="none"
            stroke={BAND_TRACK.red}
            strokeWidth={stroke}
          />
          <path
            d={topArcPath(redMax, orangeMax)}
            fill="none"
            stroke={BAND_TRACK.orange}
            strokeWidth={stroke}
          />
          <path
            d={topArcPath(orangeMax, 100)}
            fill="none"
            stroke={BAND_TRACK.green}
            strokeWidth={stroke}
          />
          {shiftPath && earliest !== latest && (
            <path
              d={shiftPath}
              fill="none"
              stroke={improving ? BAND_FILL.green : BAND_FILL.red}
              strokeWidth={stroke}
              strokeLinecap="round"
            />
          )}
          <circle
            cx={earliestPt.x}
            cy={earliestPt.y}
            r="4.5"
            fill="var(--color-bg-elevated)"
            stroke={BAND_FILL[earliestBand]}
            strokeWidth="2.5"
          />
          <circle cx={latestPt.x} cy={latestPt.y} r="5" fill={BAND_FILL[latestBand]} />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-[var(--color-text)]"
            style={{ fontSize: 15, fontWeight: 600 }}
          >
            {latest}%
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--color-text-muted)" style={{ fontSize: 9 }}>
            now
          </text>
        </svg>

        <div className="min-w-0 flex-1 pb-1">
          <div className="relative h-3 overflow-hidden rounded-full bg-[var(--color-border)]">
            <div className="absolute inset-y-0 left-0" style={{ width: `${redMax}%`, background: BAND_TRACK.red }} />
            <div
              className="absolute inset-y-0"
              style={{ left: `${redMax}%`, width: `${orangeMax - redMax}%`, background: BAND_TRACK.orange }}
            />
            <div
              className="absolute inset-y-0"
              style={{ left: `${orangeMax}%`, width: `${100 - orangeMax}%`, background: BAND_TRACK.green }}
            />
            <div
              className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-stone-600/70"
              style={{ left: `${clamp(earliest)}%` }}
              title={`Then: ${earliest}%`}
            />
            <div
              className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm"
              style={{ left: `${clamp(latest)}%`, background: BAND_FILL[latestBand] }}
              title={`Now: ${latest}%`}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
            <span>Then {earliest}%</span>
            <span
              className={
                delta === 0
                  ? "text-[var(--color-text-muted)]"
                  : improving
                    ? "font-medium text-green-600 dark:text-green-400"
                    : "font-medium text-red-600 dark:text-red-400"
              }
            >
              {delta === 0 ? "No change" : `${improving ? "+" : ""}${delta}%`}
            </span>
            <span>Now {latest}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
