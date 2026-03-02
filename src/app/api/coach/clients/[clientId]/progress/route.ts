import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { resolveThresholds } from "@/lib/scoring-utils";
import { getPerQuestionScores } from "@/lib/check-in-score";
import { formatDateDisplay, toLocalDateString } from "@/lib/format-date";

function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return toLocalDateString(d);
}

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

// GET: client progress summary for coach (profile, measurements, goals, progress images).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      client: { id: clientId, firstName: "", lastName: "" },
      measurements: [],
      goals: [],
      progressImages: [],
      checkInScores: [],
      trafficLightRedMax: 40,
      trafficLightOrangeMax: 70,
      questionProgress: { questions: [], weeks: [], grid: {} },
    });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const clientData = clientSnap.data() as { coachId?: string };
  if (clientData.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = clientSnap.data()!;
  const client = {
    id: clientSnap.id,
    firstName: (data.firstName ?? "") as string,
    lastName: (data.lastName ?? "") as string,
  };

  const [measSnap, goalsSnap, imagesSnap, responsesSnap, scoringSnap] = await Promise.all([
    db
      .collection("client_measurements")
      .where("clientId", "==", clientId)
      .orderBy("date", "desc")
      .limit(100)
      .get(),
    db.collection("clientGoals").where("clientId", "==", clientId).get(),
    db
      .collection("progress_images")
      .where("clientId", "==", clientId)
      .orderBy("uploadedAt", "desc")
      .limit(50)
      .get(),
    db
      .collection("formResponses")
      .where("clientId", "==", clientId)
      .orderBy("submittedAt", "desc")
      .limit(30)
      .get(),
    db.collection("clientScoring").doc(clientId).get(),
  ]);

  const scoringData = scoringSnap.exists
    ? (scoringSnap.data() as { thresholds?: { redMax?: number; orangeMax?: number }; scoringProfile?: string })
    : null;
  const { redMax: trafficLightRedMax, orangeMax: trafficLightOrangeMax } = resolveThresholds({
    clientScoring: scoringData ?? undefined,
  });

  const measurements = measSnap.docs.map((d) => {
    const m = d.data();
    const date = m.date?.toDate?.() ?? m.date;
    return {
      id: d.id,
      date: date ? new Date(date).toISOString().slice(0, 10) : null,
      bodyWeight: m.bodyWeight ?? null,
      measurements: m.measurements ?? {},
      isBaseline: m.isBaseline ?? false,
    };
  });

  const goals = goalsSnap.docs.map((d) => {
    const g = d.data();
    const deadline = g.deadline?.toDate?.() ?? g.deadline;
    return {
      id: d.id,
      title: g.title ?? "",
      description: g.description ?? "",
      category: g.category ?? "",
      targetValue: g.targetValue ?? 0,
      currentValue: g.currentValue ?? 0,
      unit: g.unit ?? "",
      deadline: deadline ? new Date(deadline).toISOString() : null,
      status: g.status ?? "active",
      progress: g.progress ?? 0,
    };
  });

  const progressImages = imagesSnap.docs.map((d) => {
    const img = d.data();
    return {
      id: d.id,
      imageUrl: img.imageUrl ?? "",
      imageType: img.imageType ?? null,
      caption: img.caption ?? null,
      uploadedAt: toDate(img.uploadedAt),
    };
  });

  const checkInScores = responsesSnap.docs.map((d) => {
    const r = d.data();
    const submittedAt = r.submittedAt?.toDate?.() ?? r.submittedAt;
    return {
      id: d.id,
      formTitle: (r.formTitle as string) ?? "",
      submittedAt: submittedAt ? new Date(submittedAt).toISOString() : null,
      score: typeof r.score === "number" ? r.score : 0,
    };
  });

  const weekSet = new Set<string>();
  const grid: Record<string, Record<string, number>> = {};
  const formIds = new Set<string>();
  for (const doc of responsesSnap.docs) {
    const r = doc.data();
    formIds.add((r.formId as string) ?? "");
  }
  const formSnaps = await Promise.all(
    Array.from(formIds).filter(Boolean).map((id) => db.collection("forms").doc(id).get())
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
  const responsesByWeek: { weekKey: string; formId: string; responses: Array<{ questionId: string; answer: string | number | string[] }> }[] = [];
  for (const doc of responsesSnap.docs) {
    const r = doc.data();
    const submittedAt = r.submittedAt?.toDate?.() ?? r.submittedAt;
    const submittedDate = submittedAt ? new Date(submittedAt) : null;
    if (!submittedDate || Number.isNaN(submittedDate.getTime())) continue;
    const weekKey = getMondayOf(submittedDate);
    weekSet.add(weekKey);
    const responses = (r.responses as Array<{ questionId: string; answer: string | number | string[] }>) ?? [];
    responsesByWeek.push({ weekKey, formId: r.formId as string, responses });
  }
  const weeks = Array.from(weekSet).sort();
  const questionProgressQuestions = Array.from(allQuestionIds).map((qid) => {
    const q = questionDocs.get(qid);
    return { id: qid, text: q?.text ?? qid };
  });
  for (const row of responsesByWeek) {
    const formQIds = questionIdsByForm.get(row.formId) ?? [];
    const scoringQuestions = formQIds
      .map((id) => questionDocs.get(id))
      .filter((q) => q != null) as { id: string; text: string; type?: string; options?: string[] | Array<{ text: string; weight?: number }>; questionWeight?: number; yesNoWeight?: number; yesIsPositive?: boolean }[];
    const scores = getPerQuestionScores(row.responses, scoringQuestions);
    for (const [qid, score] of Object.entries(scores)) {
      if (!grid[qid]) grid[qid] = {};
      if (grid[qid][row.weekKey] == null) grid[qid][row.weekKey] = score;
    }
  }
  const questionProgressWeeks = weeks.map((w, i) => ({ key: w, label: `${formatDateDisplay(w)} Wk ${i + 1}` }));

  return NextResponse.json({
    client,
    measurements,
    goals,
    progressImages,
    checkInScores,
    trafficLightRedMax,
    trafficLightOrangeMax,
    questionProgress: {
      questions: questionProgressQuestions,
      weeks: questionProgressWeeks,
      grid,
    },
  });
}
