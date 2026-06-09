export interface QuestionProgressInput {
  questions: Array<{ id: string; text: string }>;
  weeks: Array<{ key: string; label: string }>;
  grid: Record<string, Record<string, number>>;
}

export interface QuestionTrend {
  id: string;
  text: string;
  delta: number;
  latest: number;
  earliest: number;
}

/** Every question with at least one scored week, in form order. */
export function getAllQuestionTrends(qp: QuestionProgressInput | null): QuestionTrend[] {
  if (!qp || qp.weeks.length === 0) return [];
  const trends: QuestionTrend[] = [];
  for (const q of qp.questions) {
    const scores = qp.weeks
      .map((w) => qp.grid[q.id]?.[w.key])
      .filter((s): s is number => s != null);
    if (scores.length === 0) continue;
    const earliest = scores[0]!;
    const latest = scores[scores.length - 1]!;
    trends.push({
      id: q.id,
      text: q.text,
      delta: latest - earliest,
      latest,
      earliest,
    });
  }
  return trends;
}
