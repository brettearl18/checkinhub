import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { computeScore, getScoreBand } from "@/lib/check-in-score";
import { resolveThresholds, BAND_LABELS } from "@/lib/scoring-utils";

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

// GET: load one response + form + questions + coach feedback (client must own the response).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ responseId: string }> }
) {
  const authResult = await requireClient(_request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const uid = authResult.identity.uid;
  const { responseId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      response: {
        id: responseId,
        formTitle: "Check-in",
        responses: [],
        score: 0,
        band: "green" as const,
        message: "Excellent",
        submittedAt: null,
      },
      questions: [],
      feedback: [],
    });
  }

  const db = getAdminDb();
  const responseSnap = await db.collection("formResponses").doc(responseId).get();
  if (!responseSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const responseData = responseSnap.data()!;
  const respClientId = responseData.clientId as string;
  if (respClientId !== clientId && respClientId !== uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formId = responseData.formId as string;
  const formSnap = await db.collection("forms").doc(formId).get();
  const form = formSnap.exists
    ? { id: formSnap.id, ...formSnap.data(), questions: (formSnap.data()?.questions as string[]) ?? [] }
    : { id: formId, title: (responseData.formTitle as string) ?? "Check-in", questions: [] as string[] };

  const questionIds = Array.isArray(form.questions) ? form.questions : [];
  const questions: Array<{ id: string; text: string }> = [];
  if (questionIds.length > 0) {
    const snaps = await Promise.all(questionIds.map((id) => db.collection("questions").doc(id).get()));
    snaps.forEach((s, i) => {
      const qid = questionIds[i];
      if (s.exists) {
        const d = s.data()!;
        questions.push({ id: qid, text: (d.text as string) ?? qid });
      } else {
        questions.push({ id: qid, text: qid });
      }
    });
  }

  const feedbackSnap = await db
    .collection("coachFeedback")
    .where("responseId", "==", responseId)
    .get();
  const feedback = feedbackSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      questionId: data.questionId ?? null,
      content: data.content ?? "",
      createdAt: toDate(data.createdAt),
    };
  });

  const score = (responseData.score as number) ?? 0;
  const scoringSnap = await db.collection("clientScoring").doc(respClientId).get();
  const clientScoringData = scoringSnap.exists
    ? (scoringSnap.data() as { thresholds?: { redMax?: number; orangeMax?: number }; scoringProfile?: string })
    : null;
  const formThresholds = formSnap.exists ? (formSnap.data() as { thresholds?: { redMax?: number; orangeMax?: number } })?.thresholds : undefined;
  const { redMax, orangeMax } = resolveThresholds({
    formThresholds: formThresholds ?? undefined,
    clientScoring: clientScoringData ?? undefined,
  });
  const band = getScoreBand(score, redMax, orangeMax);
  const message = BAND_LABELS[band];

  const response = {
    id: responseSnap.id,
    assignmentId: (responseData.assignmentId as string) ?? null,
    formTitle: responseData.formTitle,
    responses: responseData.responses as Array<{ questionId: string; answer: string | number | string[] }>,
    score,
    band,
    message,
    submittedAt: toDate(responseData.submittedAt) ?? toDate(responseData.createdAt),
    readByClient: (responseData as { readByClient?: boolean }).readByClient === true,
    readByClientAt: toDate((responseData as { readByClientAt?: unknown }).readByClientAt),
  };

  const reviewedByCoach = (responseData as { reviewedByCoach?: boolean }).reviewedByCoach === true;
  let reviewDetails: { whereResponded: string[]; notes: string | null; progressRating: number | null; reviewedAt: string | null } | null = null;
  if (reviewedByCoach) {
    const rd = responseData as {
      reviewWhereResponded?: string[];
      reviewNotes?: string;
      reviewProgressRating?: number;
      reviewedAt?: unknown;
    };
    reviewDetails = {
      whereResponded: Array.isArray(rd.reviewWhereResponded) ? rd.reviewWhereResponded : [],
      notes: typeof rd.reviewNotes === "string" ? rd.reviewNotes : null,
      progressRating: typeof rd.reviewProgressRating === "number" ? rd.reviewProgressRating : null,
      reviewedAt: toDate(rd.reviewedAt),
    };
  }

  return NextResponse.json({ response, questions, feedback, reviewDetails });
}

/** PATCH: client updates their own response (edit check-in); recalculates score. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ responseId: string }> }
) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const { responseId } = await params;

  let body: { responses: Array<{ questionId: string; answer: string | number | string[]; notes?: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { responses } = body;
  if (!Array.isArray(responses)) {
    return NextResponse.json({ error: "responses array required" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ score: 0, band: "green", message: "Excellent" });
  }

  const db = getAdminDb();
  const responseRef = db.collection("formResponses").doc(responseId);
  const responseSnap = await responseRef.get();
  if (!responseSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const responseData = responseSnap.data()!;
  if ((responseData.clientId as string) !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formId = responseData.formId as string;
  const formSnap = await db.collection("forms").doc(formId).get();
  const questionIds = formSnap.exists ? ((formSnap.data() as { questions?: string[] }).questions ?? []) : [];
  const questionSnaps = await Promise.all(
    questionIds.map((id: string) => db.collection("questions").doc(id).get())
  );
  const questions = questionSnaps
    .filter((s) => s.exists)
    .map((s) => ({ id: s.id, ...s.data() })) as Array<{
    id: string;
    type?: string;
    options?: string[] | Array<{ text: string; weight?: number }>;
    questionWeight?: number;
    yesNoWeight?: number;
    yesIsPositive?: boolean;
  }>;

  const score = computeScore(responses, questions);

  const scoringSnap = await db.collection("clientScoring").doc(clientId).get();
  const clientScoringData = scoringSnap.exists
    ? (scoringSnap.data() as { thresholds?: { redMax?: number; orangeMax?: number }; scoringProfile?: string })
    : null;
  const formThresholds = formSnap.exists ? (formSnap.data() as { thresholds?: { redMax?: number; orangeMax?: number } })?.thresholds : undefined;
  const { redMax, orangeMax } = resolveThresholds({
    formThresholds: formThresholds ?? undefined,
    clientScoring: clientScoringData ?? undefined,
  });
  const band = getScoreBand(score, redMax, orangeMax);
  const message = BAND_LABELS[band];

  const now = new Date();
  await responseRef.update({
    responses,
    score,
    answeredQuestions: responses.length,
    updatedAt: now,
  });

  return NextResponse.json({
    score,
    band,
    message,
    trafficLightRedMax: redMax,
    trafficLightOrangeMax: orangeMax,
  });
}
