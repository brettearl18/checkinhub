import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { identity } = authResult;
  const clientId = identity.clientId!;

  let body: { assignmentId: string; responses: Array<{ questionId: string; answer: string | number | string[] }> };
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
    return NextResponse.json({ responseId: "mock-response-1", success: true });
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

  const now = new Date();
  const score = 0;
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
  });

  return NextResponse.json({ responseId: responseRef.id, success: true });
}
