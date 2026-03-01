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

// GET: list messages in the client's conversation with their coach.
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  try {
    const db = getAdminDb();
    const clientSnap = await db.collection("clients").doc(clientId).get();
    if (!clientSnap.exists) return NextResponse.json([]);
    const coachId = (clientSnap.data() as { coachId?: string }).coachId;
    if (!coachId) return NextResponse.json([]);

    const conversationId = `${clientId}_${coachId}`;
    const snap = await db
      .collection("messages")
      .where("conversationId", "==", conversationId)
      .orderBy("timestamp", "asc")
      .get();

    const messages = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        senderId: data.senderId,
        senderName: data.senderName ?? null,
        content: data.content ?? "",
        timestamp: toDate(data.timestamp),
        isRead: data.isRead ?? false,
      };
    });
    return NextResponse.json(messages);
  } catch (err) {
    console.error("[client/conversation/messages GET]", err);
    const message =
      err instanceof Error && /index|indexes/i.test(err.message)
        ? "Messages query needs a Firestore index. Deploy firestore.indexes.json or create the index in Firebase Console."
        : "Failed to load messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: send a message (client is sender).
export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  let body: { content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ id: "mock-msg-1" });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const coachId = (clientSnap.data() as { coachId?: string }).coachId;
  if (!coachId) return NextResponse.json({ error: "No coach assigned" }, { status: 403 });

  const conversationId = `${clientId}_${coachId}`;
  const clientData = clientSnap.data() as { firstName?: string; lastName?: string };
  const senderName = [clientData.firstName, clientData.lastName].filter(Boolean).join(" ") || "Client";

  const now = new Date();
  const ref = await db.collection("messages").add({
    senderId: clientId,
    senderName,
    content,
    type: "text",
    timestamp: now,
    isRead: false,
    participants: [clientId, coachId],
    conversationId,
  });
  return NextResponse.json({ id: ref.id, timestamp: now.toISOString() });
}
