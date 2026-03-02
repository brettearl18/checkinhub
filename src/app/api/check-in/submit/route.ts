import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { computeScore, getScoreBand } from "@/lib/check-in-score";
import { resolveThresholds, BAND_LABELS } from "@/lib/scoring-utils";

export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { identity } = authResult;
  const clientId = identity.clientId!;

  let body: {
    assignmentId: string;
    responses: Array<{ questionId: string; answer: string | number | string[]; notes?: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { assignmentId, responses } = body;
  if (!assignmentId || !Array.isArray(responses)) {
    return NextResponse.json(
      { error: "assignmentId and responses required" },
      { status: 400 }
    );
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({
      responseId: "mock-response-1",
      success: true,
      score: 0,
      band: "green",
      message: "Excellent",
    });
  }

  const db = getAdminDb();
  const assignmentRef = db.collection("check_in_assignments").doc(assignmentId);
  const assignmentSnap = await assignmentRef.get();
  if (!assignmentSnap.exists) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  const assignmentData = assignmentSnap.data()!;
  if (assignmentData.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (assignmentData.responseId) {
    return NextResponse.json({ error: "Already submitted" }, { status: 400 });
  }

  const formId = assignmentData.formId as string;
  const formSnap = await db.collection("forms").doc(formId).get();
  const questionIds = formSnap.exists ? ((formSnap.data() as { questions?: string[] }).questions ?? []) : [];
  const questionSnaps = await Promise.all(questionIds.map((id: string) => db.collection("questions").doc(id).get()));
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

  const formData = formSnap.exists ? formSnap.data() : null;
  const scoringSnap = await db.collection("clientScoring").doc(clientId).get();
  const clientScoringData = scoringSnap.exists ? (scoringSnap.data() as { thresholds?: unknown; scoringProfile?: string }) : null;
  const { redMax, orangeMax } = resolveThresholds({
    formThresholds: formData?.thresholds as { redMax?: number; orangeMax?: number } | undefined,
    clientScoring: clientScoringData ?? undefined,
  });
  const band = getScoreBand(score, redMax, orangeMax);
  const message = BAND_LABELS[band];

  const now = new Date();
  const responseRef = await db.collection("formResponses").add({
    assignmentId,
    formId: assignmentData.formId,
    formTitle: assignmentData.formTitle,
    clientId,
    coachId: assignmentData.coachId ?? null,
    responses,
    score,
    totalQuestions: responses.length,
    answeredQuestions: responses.length,
    submittedAt: now,
    status: "completed",
    createdAt: now,
    updatedAt: now,
  });

  await assignmentRef.update({
    responseId: responseRef.id,
    status: "completed",
    completedAt: now,
    updatedAt: now,
    draftResponses: FieldValue.delete(),
    draftUpdatedAt: FieldValue.delete(),
  });

  return NextResponse.json({
    responseId: responseRef.id,
    success: true,
    score,
    band,
    message,
    trafficLightRedMax: redMax,
    trafficLightOrangeMax: orangeMax,
  });
}
