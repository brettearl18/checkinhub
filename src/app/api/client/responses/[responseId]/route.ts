import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

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
      response: { id: responseId, formTitle: "Check-in", responses: [], score: 0, submittedAt: null },
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

  const response = {
    id: responseSnap.id,
    formTitle: responseData.formTitle,
    responses: responseData.responses as Array<{ questionId: string; answer: string | number | string[] }>,
    score: (responseData.score as number) ?? 0,
    submittedAt: toDate(responseData.submittedAt) ?? toDate(responseData.createdAt),
  };

  return NextResponse.json({ response, questions, feedback });
}
