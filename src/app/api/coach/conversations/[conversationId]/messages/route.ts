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

// GET: list messages in this conversation (coach must be participant).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { conversationId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  const parts = conversationId.split("_");
  const clientId = parts[0];
  const coachIdInConv = parts.slice(1).join("_");
  if (coachIdInConv !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists || (clientSnap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
}

// POST: send a message (coach is sender).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { conversationId } = await params;

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

  const parts = conversationId.split("_");
  const clientId = parts[0];
  const coachIdInConv = parts.slice(1).join("_");
  if (coachIdInConv !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists || (clientSnap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userSnap = await db.collection("users").doc(coachId).get();
  const senderName = userSnap.exists
    ? [userSnap.data()?.firstName, userSnap.data()?.lastName].filter(Boolean).join(" ") || undefined
    : undefined;

  const now = new Date();
  const ref = await db.collection("messages").add({
    senderId: coachId,
    senderName: senderName ?? null,
    content,
    type: "text",
    timestamp: now,
    isRead: false,
    participants: [clientId, coachId],
    conversationId,
  });
  return NextResponse.json({ id: ref.id, timestamp: now.toISOString() });
}
