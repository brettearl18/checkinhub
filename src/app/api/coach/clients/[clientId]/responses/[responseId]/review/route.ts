import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

const WHERE_RESPONDED_VALUES = ["whatsapp", "phone_call", "email", "checkinhub", "other"] as const;

// POST: mark this response as reviewed by the coach; optional body: whereResponded[], notes, progressRating (1-10).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string; responseId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId, responseId } = await params;

  let body: { whereResponded?: string[]; notes?: string; progressRating?: number } = {};
  try {
    const raw = await request.json();
    if (raw && typeof raw === "object") {
      body = {
        whereResponded: Array.isArray(raw.whereResponded)
          ? raw.whereResponded.filter((v: unknown) => typeof v === "string" && WHERE_RESPONDED_VALUES.includes(v as typeof WHERE_RESPONDED_VALUES[number]))
          : [],
        notes: typeof raw.notes === "string" ? raw.notes.trim() : undefined,
        progressRating:
          typeof raw.progressRating === "number" && raw.progressRating >= 1 && raw.progressRating <= 10
            ? Math.round(raw.progressRating)
            : undefined,
      };
    }
  } catch {
    // optional body
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
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
  const responseData = responseSnap.data() as { reviewedByCoach?: boolean; assignmentId?: string };
  if (responseData.reviewedByCoach) {
    return NextResponse.json({ ok: true, alreadyReviewed: true });
  }

  const now = new Date();
  const ts = Timestamp.fromDate(now);
  const updateData: Record<string, unknown> = {
    reviewedByCoach: true,
    reviewedAt: ts,
    reviewedBy: coachId,
    updatedAt: ts,
  };
  if (body.whereResponded && body.whereResponded.length > 0) {
    updateData.reviewWhereResponded = body.whereResponded;
  }
  if (body.notes != null && body.notes !== "") {
    updateData.reviewNotes = body.notes;
  }
  if (typeof body.progressRating === "number") {
    updateData.reviewProgressRating = body.progressRating;
  }

  try {
    await db.collection("formResponses").doc(responseId).update(updateData);
  } catch (err) {
    console.error("[review] formResponses.update error:", err);
    return NextResponse.json(
      { error: "Failed to save review", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }

  try {
    const assignmentId = responseData.assignmentId;
    if (assignmentId) {
      const assignRef = db.collection("check_in_assignments").doc(assignmentId);
      const assignSnap = await assignRef.get();
      if (assignSnap.exists) {
        await assignRef.update({
          reviewedByCoach: true,
          reviewedAt: now,
          reviewedBy: coachId,
          updatedAt: now,
        });
      }
    } else {
      const assignSnap = await db
        .collection("check_in_assignments")
        .where("responseId", "==", responseId)
        .limit(1)
        .get();
      if (!assignSnap.empty) {
        await assignSnap.docs[0].ref.update({
          reviewedByCoach: true,
          reviewedAt: ts,
          reviewedBy: coachId,
          updatedAt: ts,
        });
      }
    }
  } catch (err) {
    console.error("[review] assignment update error (non-fatal):", err);
  }

  try {
    const clientData = clientSnap.data() as { authUid?: string; email?: string };
    let userId: string | null = clientData?.authUid ?? null;
    if (!userId && clientData?.email) {
      const usersSnap = await db.collection("users").where("email", "==", clientData.email).limit(1).get();
      if (!usersSnap.empty) userId = usersSnap.docs[0].id;
    }
    if (!userId) userId = clientId;
    await db.collection("notifications").add({
      userId,
      type: "coach_reviewed",
      title: "Check-in reviewed",
      message: "Your coach has marked your check-in as reviewed. View your feedback.",
      actionUrl: `/client/response/${responseId}`,
      metadata: { responseId, clientId },
      isRead: false,
      createdAt: ts,
    });
  } catch (err) {
    console.error("[review] notification add error (non-fatal):", err);
  }

  return NextResponse.json({ ok: true });
}
