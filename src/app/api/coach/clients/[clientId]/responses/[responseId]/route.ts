import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { getScoreBand } from "@/lib/check-in-score";
import { resolveThresholds, BAND_LABELS } from "@/lib/scoring-utils";

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

// GET: load one form response with form + questions so coach can view past check-in answers.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string; responseId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId, responseId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      response: {
        id: responseId,
        formId: "form-1",
        formTitle: "Weekly check-in",
        clientId,
        responses: [{ questionId: "q1", answer: "Sample answer" }],
        score: 75,
        band: "green",
        message: "Excellent",
        submittedAt: new Date().toISOString(),
      },
      form: { id: "form-1", title: "Weekly check-in", questions: ["q1"] },
      questions: [{ id: "q1", text: "How are you feeling?" }],
    });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if ((clientSnap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const responseSnap = await db.collection("formResponses").doc(responseId).get();
  if (!responseSnap.exists) {
    return NextResponse.json({ error: "Response not found" }, { status: 404 });
  }
  const responseData = responseSnap.data()!;
  if (responseData.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formId = responseData.formId as string;
  const formSnap = await db.collection("forms").doc(formId).get();
  const form = formSnap.exists
    ? { id: formSnap.id, ...formSnap.data(), questions: (formSnap.data()?.questions as string[]) ?? [] }
    : { id: formId, title: (responseData.formTitle as string) ?? "Check-in", questions: [] as string[] };

  const questionIds = Array.isArray(form.questions) ? form.questions : [];
  const questions: Array<{ id: string; text: string; type?: string }> = [];
  if (questionIds.length > 0) {
    const snaps = await Promise.all(questionIds.map((id) => db.collection("questions").doc(id).get()));
    snaps.forEach((s, i) => {
      const qid = questionIds[i];
      if (s.exists) {
        const d = s.data()!;
        questions.push({ id: qid, text: (d.text as string) ?? qid, type: d.type as string });
      } else {
        questions.push({ id: qid, text: qid, type: "text" });
      }
    });
  }

  const score = (responseData.score as number) ?? 0;
  const scoringSnap = await db.collection("clientScoring").doc(clientId).get();
  const clientScoringData = scoringSnap.exists ? (scoringSnap.data() as { thresholds?: unknown; scoringProfile?: string }) : null;
  const formThresholds = formSnap.exists ? (formSnap.data() as { thresholds?: { redMax?: number; orangeMax?: number } })?.thresholds : undefined;
  const { redMax, orangeMax } = resolveThresholds({
    formThresholds: formThresholds ?? undefined,
    clientScoring: clientScoringData ?? undefined,
  });
  const band = getScoreBand(score, redMax, orangeMax);
  const message = BAND_LABELS[band];

  const response = {
    id: responseSnap.id,
    formId: responseData.formId,
    formTitle: responseData.formTitle,
    clientId: responseData.clientId,
    responses: responseData.responses as Array<{ questionId: string; answer: string | number | string[]; score?: number }>,
    score,
    band,
    message,
    submittedAt: toDate(responseData.submittedAt) ?? toDate(responseData.createdAt),
  };

  return NextResponse.json({ response, form, questions });
}
