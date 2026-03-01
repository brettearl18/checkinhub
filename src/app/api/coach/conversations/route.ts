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

// GET: list conversations for this coach (last message + client info per conversation).
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  const db = getAdminDb();
  const snap = await db
    .collection("messages")
    .where("participants", "array-contains", coachId)
    .orderBy("timestamp", "desc")
    .limit(200)
    .get();

  const byConv = new Map<string, { lastMessage: { content: string; timestamp: string; senderId: string }; clientId: string }>();
  for (const d of snap.docs) {
    const data = d.data();
    const cid = data.conversationId as string;
    if (!cid || byConv.has(cid)) continue;
    const parts = cid.split("_");
    const clientId = parts[0];
    const coachIdInConv = parts.slice(1).join("_");
    if (coachIdInConv !== coachId) continue;
    byConv.set(cid, {
      lastMessage: {
        content: (data.content as string) ?? "",
        timestamp: toDate(data.timestamp) ?? "",
        senderId: (data.senderId as string) ?? "",
      },
      clientId,
    });
  }

  const clientIds = [...new Set([...byConv.values()].map((v) => v.clientId))];
  const clientSnaps = await Promise.all(clientIds.map((id) => db.collection("clients").doc(id).get()));
  const clientNames = new Map<string, string>();
  clientSnaps.forEach((s, i) => {
    const id = clientIds[i];
    if (s.exists) {
      const d = s.data() as { firstName?: string; lastName?: string };
      clientNames.set(id, [d.firstName, d.lastName].filter(Boolean).join(" ") || id);
    }
  });

  const list = [...byConv.entries()].map(([conversationId, v]) => ({
    conversationId,
    clientId: v.clientId,
    clientName: clientNames.get(v.clientId) ?? v.clientId,
    lastMessage: v.lastMessage,
  }));

  return NextResponse.json(list);
}
