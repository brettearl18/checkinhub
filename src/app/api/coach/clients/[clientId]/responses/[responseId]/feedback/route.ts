import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/push-server";

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
  const responseData = responseSnap.data() as {
    clientId?: string;
    coachResponded?: boolean;
    assignmentId?: string;
  };

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

  // First feedback: set coachResponded on formResponses and linked assignment; notify client.
  const isFirstFeedback = !responseData.coachResponded;
  if (isFirstFeedback) {
    const responseRef = db.collection("formResponses").doc(responseId);
    await responseRef.update({
      coachResponded: true,
      coachRespondedAt: now,
      feedbackStatus: "responded",
      updatedAt: now,
    });
    const assignmentId = responseData.assignmentId;
    if (assignmentId) {
      const assignRef = db.collection("check_in_assignments").doc(assignmentId);
      await assignRef.update({
        coachResponded: true,
        coachRespondedAt: now,
        workflowStatus: "responded",
        updatedAt: now,
      });
    } else {
      const assignSnap = await db
        .collection("check_in_assignments")
        .where("responseId", "==", responseId)
        .limit(1)
        .get();
      if (!assignSnap.empty) {
        await assignSnap.docs[0].ref.update({
          coachResponded: true,
          coachRespondedAt: now,
          workflowStatus: "responded",
          updatedAt: now,
        });
      }
    }
    // In-app + push: "Coach [Name] has responded to your check in"
    const clientSnap = await db.collection("clients").doc(clientId).get();
    const clientData = clientSnap.exists ? (clientSnap.data() as { authUid?: string; email?: string }) : null;
    let userId: string | null = clientData?.authUid ?? null;
    if (!userId && clientData?.email) {
      const usersSnap = await db.collection("users").where("email", "==", clientData.email).limit(1).get();
      if (!usersSnap.empty) userId = usersSnap.docs[0].id;
    }
    if (!userId) userId = clientId;
    const coachSnap = await db.collection("users").doc(coachId).get();
    const coachData = coachSnap.exists ? (coachSnap.data() as { firstName?: string; lastName?: string }) : null;
    const coachName = coachData
      ? [coachData.firstName, coachData.lastName].filter(Boolean).join(" ").trim() || "Your coach"
      : "Your coach";
    const title = `Coach ${coachName} has responded to your check in`;
    const actionUrl = `/client/response/${responseId}`;
    await db.collection("notifications").add({
      userId,
      type: "coach_feedback",
      title,
      message: "Tap to view their feedback.",
      actionUrl,
      metadata: { responseId, clientId },
      isRead: false,
      createdAt: now,
    });
    try {
      await sendPushToUser({
        userId,
        title,
        body: "Tap to view their feedback.",
        actionPath: actionUrl,
        tag: "coach_feedback",
      });
    } catch {
      // in-app notification already saved
    }
  }

  return NextResponse.json({ id: ref.id });
}
