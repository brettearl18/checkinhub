import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { getPerQuestionScores } from "@/lib/check-in-score";
import { resolveThresholds } from "@/lib/scoring-utils";
import { formatDateDisplay, toLocalDateString } from "@/lib/format-date";

function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return toLocalDateString(d);
}

/** GET: question progress grid for client (questions x weeks, scores 0–100 for traffic light). */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({ questions: [], weeks: [], grid: {}, trafficLightRedMax: 40, trafficLightOrangeMax: 70 });
  }

  const db = getAdminDb();
  const responsesSnap = await db
    .collection("formResponses")
    .where("clientId", "==", clientId)
    .orderBy("submittedAt", "desc")
    .limit(50)
    .get();

  const scoringSnap = await db.collection("clientScoring").doc(clientId).get();
  const clientScoringData = scoringSnap.exists ? (scoringSnap.data() as { thresholds?: unknown; scoringProfile?: string }) : null;
  const { redMax: trafficLightRedMax, orangeMax: trafficLightOrangeMax } = resolveThresholds({
    clientScoring: clientScoringData ?? undefined,
  });

  const weekSet = new Set<string>();
  const grid: Record<string, Record<string, number>> = {};

  const formIds = new Set<string>();
  for (const doc of responsesSnap.docs) {
    const r = doc.data();
    const formId = r.formId as string;
    formIds.add(formId);
  }

  const formSnaps = await Promise.all(
    Array.from(formIds).map((id) => db.collection("forms").doc(id).get())
  );
  const questionIdsByForm = new Map<string, string[]>();
  const allQuestionIds = new Set<string>();
  for (const formSnap of formSnaps) {
    if (!formSnap.exists) continue;
    const qIds = (formSnap.data()?.questions as string[]) ?? [];
    questionIdsByForm.set(formSnap.id, qIds);
    qIds.forEach((id) => allQuestionIds.add(id));
  }

  const questionSnaps = await Promise.all(
    Array.from(allQuestionIds).map((id) => db.collection("questions").doc(id).get())
  );
  const questionDocs = new Map<string, { id: string; text: string; type?: string; options?: unknown; questionWeight?: number; yesNoWeight?: number; yesIsPositive?: boolean }>();
  for (const snap of questionSnaps) {
    if (snap.exists) {
      const d = snap.data()!;
      questionDocs.set(snap.id, {
        id: snap.id,
        text: (d.text as string) ?? snap.id,
        type: d.type,
        options: d.options,
        questionWeight: d.questionWeight,
        yesNoWeight: d.yesNoWeight,
        yesIsPositive: d.yesIsPositive,
      });
    }
  }

  const responsesByWeek: { weekKey: string; submittedAt: number; formId: string; responses: Array<{ questionId: string; answer: string | number | string[] }> }[] = [];
  for (const doc of responsesSnap.docs) {
    const r = doc.data();
    const submittedAt = r.submittedAt?.toDate?.() ?? r.submittedAt;
    const submittedDate = submittedAt ? new Date(submittedAt) : null;
    if (!submittedDate || Number.isNaN(submittedDate.getTime())) continue;
    const weekKey = getMondayOf(submittedDate);
    weekSet.add(weekKey);
    const responses = (r.responses as Array<{ questionId: string; answer: string | number | string[] }>) ?? [];
    responsesByWeek.push({
      weekKey,
      submittedAt: submittedDate.getTime(),
      formId: r.formId as string,
      responses,
    });
  }

  const weeks = Array.from(weekSet).sort();
  const questions = Array.from(allQuestionIds).map((qid) => {
    const q = questionDocs.get(qid);
    return { id: qid, text: q?.text ?? qid };
  });

  for (const row of responsesByWeek) {
    const formQIds = questionIdsByForm.get(row.formId) ?? [];
    const scoringQuestions = formQIds
      .map((id) => questionDocs.get(id))
      .filter((q) => q != null) as { id: string; text: string; type?: string; options?: unknown; questionWeight?: number; yesNoWeight?: number; yesIsPositive?: boolean }[];
    const scores = getPerQuestionScores(row.responses, scoringQuestions);
    for (const [qid, score] of Object.entries(scores)) {
      if (!grid[qid]) grid[qid] = {};
      if (grid[qid][row.weekKey] == null) grid[qid][row.weekKey] = score;
    }
  }

  const weekLabels = weeks.map((w, i) => ({
    key: w,
    label: `${formatDateDisplay(w)} Wk ${i + 1}`,
  }));

  return NextResponse.json({
    questions: questions.map((q) => ({ id: q.id, text: q.text })),
    weeks: weekLabels,
    grid,
    trafficLightRedMax,
    trafficLightOrangeMax,
  });
}
