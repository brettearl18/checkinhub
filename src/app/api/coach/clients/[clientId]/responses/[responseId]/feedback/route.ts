import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

// GET: list feedback for this response (coach must own client).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string; responseId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId, responseId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists || (clientSnap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const responseSnap = await db.collection("formResponses").doc(responseId).get();
  if (!responseSnap.exists || (responseSnap.data() as { clientId?: string }).clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const snap = await db
    .collection("coachFeedback")
    .where("responseId", "==", responseId)
    .get();

  const list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      responseId: data.responseId,
      questionId: data.questionId ?? null,
      feedbackType: data.feedbackType ?? "text",
      content: data.content ?? "",
      createdAt: toDate(data.createdAt),
    };
  });
  return NextResponse.json(list);
}

// POST: add feedback (text only for now).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string; responseId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId, responseId } = await params;

  let body: { questionId?: string | null; feedbackType?: "text" | "voice"; content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { questionId = null, feedbackType = "text", content } = body;
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ id: "mock-feedback-1" });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists || (clientSnap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const responseSnap = await db.collection("formResponses").doc(responseId).get();
  if (!responseSnap.exists || (responseSnap.data() as { clientId?: string }).clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const ref = await db.collection("coachFeedback").add({
    responseId,
    coachId,
    clientId,
    questionId: questionId ?? null,
    feedbackType: feedbackType === "voice" ? "voice" : "text",
    content: content.trim(),
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ id: ref.id });
}
