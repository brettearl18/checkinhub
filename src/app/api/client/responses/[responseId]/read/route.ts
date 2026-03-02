import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

// POST: mark this response as read by the client (e.g. when they view the page).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ responseId: string }> }
) {
  const authResult = await requireClient(_request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const uid = authResult.identity.uid;
  const { responseId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  const responseRef = db.collection("formResponses").doc(responseId);
  const responseSnap = await responseRef.get();
  if (!responseSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const responseData = responseSnap.data()!;
  const respClientId = responseData.clientId as string;
  if (respClientId !== clientId && respClientId !== uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if ((responseData as { readByClient?: boolean }).readByClient) {
    return NextResponse.json({ ok: true, alreadyRead: true });
  }

  const now = new Date();
  await responseRef.update({
    readByClient: true,
    readByClientAt: now,
    updatedAt: now,
  });

  const assignmentId = responseData.assignmentId as string | undefined;
  if (assignmentId) {
    const assignRef = db.collection("check_in_assignments").doc(assignmentId);
    const assignSnap = await assignRef.get();
    if (assignSnap.exists) {
      await assignRef.update({
        readByClient: true,
        readByClientAt: now,
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
        readByClient: true,
        readByClientAt: now,
        updatedAt: now,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
