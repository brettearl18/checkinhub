/** Question shape used for scoring (subset of full question). */
export interface ScoringQuestion {
  id: string;
  type?: string;
  options?: string[] | Array<{ text: string; weight?: number }>;
  questionWeight?: number;
  weight?: number;
  yesNoWeight?: number;
  yesIsPositive?: boolean;
}

function optionMatches(
  opt: string | { text: string; weight?: number },
  selected: string | number
): boolean {
  if (typeof selected === "number") return false;
  const label = typeof opt === "string" ? opt : opt?.text;
  if (label == null) return false;
  return String(label).trim().toLowerCase() === String(selected).trim().toLowerCase();
}

/** Compute 0–100 overall score from responses using form questions. */
export function computeScore(
  responses: Array<{ questionId: string; answer: string | number | string[] }>,
  questions: ScoringQuestion[]
): number {
  const qMap = new Map(questions.map((q) => [q.id, q]));
  let total = 0;
  let count = 0;
  for (const r of responses) {
    const q = qMap.get(r.questionId);
    if (!q) continue;
    let points: number | null = null;
    if (q.type === "scale" && typeof r.answer === "number") {
      points = Math.min(100, Math.max(0, (r.answer / 10) * 100));
    } else if (q.type === "scale" && typeof r.answer === "string" && /^\d+$/.test(r.answer)) {
      points = Math.min(100, Math.max(0, (parseInt(r.answer, 10) / 10) * 100));
    } else if (Array.isArray(q.options) && q.options.length > 0) {
      const opts = q.options;
      const selected = Array.isArray(r.answer) ? r.answer[0] : r.answer;
      const idx =
        typeof selected === "number"
          ? selected
          : opts.findIndex((o) => optionMatches(o, selected));
      if (idx >= 0) {
        const o = opts[idx];
        const hasWeight = o && typeof o === "object" && typeof (o as { weight?: number }).weight === "number";
        if (hasWeight) {
          const raw = (o as { weight: number }).weight;
          points = raw <= 10 ? raw * 10 : raw;
          points = Math.min(100, Math.max(0, points));
        } else if (opts.length === 1) {
          points = 50;
        } else {
          points = 10 + (idx / (opts.length - 1)) * 90;
        }
      }
    } else if (q.type === "yes_no" || q.type === "boolean") {
      const yes = r.answer === true || r.answer === "yes" || r.answer === "Yes" || r.answer === 1;
      const yesVal = q.yesNoWeight != null ? q.yesNoWeight : 80;
      const noVal = q.yesNoWeight != null ? 100 - q.yesNoWeight : 30;
      points = q.yesIsPositive !== false ? (yes ? yesVal : noVal) : (yes ? 100 - yesVal : 100 - noVal);
      points = Math.min(100, Math.max(0, points));
    }
    if (points != null && !Number.isNaN(points)) {
      const w = typeof q.questionWeight === "number" ? q.questionWeight : (typeof q.weight === "number" ? q.weight : 5);
      if (w <= 0) continue;
      total += points * w;
      count += w;
    }
  }
  if (count === 0) return 0;
  return Math.round(total / count);
}

/** Per-question score 0–100 for each response item (for progress grid). Unscored questions are omitted. */
export function getPerQuestionScores(
  responses: Array<{ questionId: string; answer: string | number | string[] }>,
  questions: ScoringQuestion[]
): Record<string, number> {
  const qMap = new Map(questions.map((q) => [q.id, q]));
  const out: Record<string, number> = {};
  for (const r of responses) {
    const q = qMap.get(r.questionId);
    if (!q) continue;
    let points: number | null = null;
    if (q.type === "scale" && typeof r.answer === "number") {
      points = Math.min(100, Math.max(0, (r.answer / 10) * 100));
    } else if (q.type === "scale" && typeof r.answer === "string" && /^\d+$/.test(r.answer)) {
      points = Math.min(100, Math.max(0, (parseInt(r.answer, 10) / 10) * 100));
    } else if (Array.isArray(q.options) && q.options.length > 0) {
      const opts = q.options;
      const selected = Array.isArray(r.answer) ? r.answer[0] : r.answer;
      const idx =
        typeof selected === "number"
          ? selected
          : opts.findIndex((o) => optionMatches(o, selected));
      if (idx >= 0) {
        const o = opts[idx];
        const hasWeight = o && typeof o === "object" && typeof (o as { weight?: number }).weight === "number";
        if (hasWeight) {
          const raw = (o as { weight: number }).weight;
          points = raw <= 10 ? raw * 10 : raw;
          points = Math.min(100, Math.max(0, points));
        } else if (opts.length === 1) {
          points = 50;
        } else {
          points = 10 + (idx / (opts.length - 1)) * 90;
        }
      }
    } else if (q.type === "yes_no" || q.type === "boolean") {
      const yes = r.answer === true || r.answer === "yes" || r.answer === "Yes" || r.answer === 1;
      const yesVal = q.yesNoWeight != null ? q.yesNoWeight : 80;
      const noVal = q.yesNoWeight != null ? 100 - q.yesNoWeight : 30;
      points = q.yesIsPositive !== false ? (yes ? yesVal : noVal) : (yes ? 100 - yesVal : 100 - noVal);
      points = Math.min(100, Math.max(0, points));
    }
    if (points != null && !Number.isNaN(points)) {
      const w = typeof q.questionWeight === "number" ? q.questionWeight : (typeof q.weight === "number" ? q.weight : 5);
      if (w <= 0) continue;
      out[r.questionId] = Math.round(points);
    }
  }
  return out;
}

export function getScoreBand(
  score: number,
  redMax: number,
  orangeMax: number
): "red" | "orange" | "green" {
  if (score <= redMax) return "red";
  if (score <= orangeMax) return "orange";
  return "green";
}
