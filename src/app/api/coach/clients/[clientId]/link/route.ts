import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminAuth, getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

/** POST: attach an unlinked (self-registered) client to the signed-in coach's roster. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  if (!clientId) {
    return NextResponse.json({ error: "Client id is required." }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  }

  const db = getAdminDb();
  const auth = getAdminAuth();
  const clientRef = db.collection("clients").doc(clientId);
  const clientSnap = await clientRef.get();

  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const data = clientSnap.data() as {
    coachId?: string;
    authUid?: string;
    status?: string;
  };

  const existingCoachId = typeof data.coachId === "string" ? data.coachId : null;
  if (existingCoachId === coachId) {
    return NextResponse.json({ ok: true, clientId, alreadyLinked: true });
  }
  if (existingCoachId && existingCoachId !== coachId) {
    return NextResponse.json(
      { error: "This client is already linked to another coach." },
      { status: 409 }
    );
  }

  const now = Timestamp.now();
  await clientRef.set({ coachId, updatedAt: now }, { merge: true });

  const authUid = typeof data.authUid === "string" ? data.authUid : clientId;
  try {
    const user = await auth.getUser(authUid);
    const claims = (user.customClaims ?? {}) as Record<string, unknown>;
    await auth.setCustomUserClaims(authUid, {
      ...claims,
      role: "client",
      coachId,
    });
  } catch {
    // Client doc updated; Auth uid may differ — roster still works via Firestore coachId filter
  }

  return NextResponse.json({ ok: true, clientId });
}
