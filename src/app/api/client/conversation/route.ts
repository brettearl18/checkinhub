import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

// GET: get the client's single conversation with their coach (conversationId + coach name).
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({ conversationId: null, coachName: null });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ conversationId: null, coachName: null });
  }
  const coachId = (clientSnap.data() as { coachId?: string }).coachId;
  if (!coachId) {
    return NextResponse.json({ conversationId: null, coachName: null });
  }

  const conversationId = `${clientId}_${coachId}`;
  const coachSnap = await db.collection("users").doc(coachId).get();
  const coachName = coachSnap.exists
    ? [coachSnap.data()?.firstName, coachSnap.data()?.lastName].filter(Boolean).join(" ") || "Coach"
    : "Coach";

  return NextResponse.json({ conversationId, coachName });
}
