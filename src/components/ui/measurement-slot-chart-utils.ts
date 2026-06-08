/** Tight Y-axis padding so small changes read clearly on coach progress charts. */
export function slotChartYDomain(
  values: number[],
  unit: string
): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 10], ticks: [0, 5, 10] };

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const range = dataMax - dataMin;
  const isKg = unit === "kg";

  const padding = isKg ? Math.max(0.4, range * 0.06) : Math.max(1, range * 0.06);
  const minSpan = isKg ? 1.5 : 4;
  const mid = (dataMin + dataMax) / 2;

  let domainMin: number;
  let domainMax: number;
  if (range < minSpan) {
    domainMin = mid - minSpan / 2;
    domainMax = mid + minSpan / 2;
  } else {
    domainMin = dataMin - padding;
    domainMax = dataMax + padding;
  }

  const span = domainMax - domainMin;
  let step: number;
  if (isKg) {
    if (span <= 2) step = 0.5;
    else if (span <= 5) step = 1;
    else if (span <= 12) step = 2;
    else step = 5;
  } else {
    if (span <= 8) step = 1;
    else if (span <= 20) step = 2;
    else if (span <= 40) step = 5;
    else step = 10;
  }

  const ticks: number[] = [];
  const start = Math.floor(domainMin / step) * step;
  for (let v = start; v <= domainMax + step * 0.25; v += step) {
    if (v >= domainMin - 0.001) ticks.push(Math.round(v * 100) / 100);
  }
  if (ticks.length < 2) return { domain: [domainMin, domainMax], ticks: [domainMin, domainMax] };

  return { domain: [domainMin, domainMax], ticks };
}

/** X-axis spans only readings with data so points are spaced wider (not stretched across 20 slots). */
export function slotChartXAxis(filledMaxSlot: number): {
  domain: [number, number];
  ticks: number[];
  label: string;
} {
  if (filledMaxSlot < 0) {
    return { domain: [0, 1], ticks: [0], label: "Reading #" };
  }
  const domain: [number, number] = [-0.35, filledMaxSlot + 0.35];
  const ticks: number[] = [];
  const count = filledMaxSlot + 1;
  const step = count <= 8 ? 1 : count <= 14 ? 2 : 4;
  for (let i = 0; i <= filledMaxSlot; i += step) ticks.push(i);
  if (ticks[ticks.length - 1] !== filledMaxSlot) ticks.push(filledMaxSlot);
  const label =
    count === 1 ? "Reading #1" : `Reading # (1–${count})`;
  return { domain, ticks, label };
}

export function maxFilledSlot(
  rows: Array<{ slot: number; value?: number | null; left?: number | null; right?: number | null }>
): number {
  let max = -1;
  for (const r of rows) {
    const has =
      (r.value != null && r.value !== undefined) ||
      r.left != null ||
      r.right != null;
    if (has && r.slot > max) max = r.slot;
  }
  return max;
}
