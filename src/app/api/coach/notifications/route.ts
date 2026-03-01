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

// GET: list notifications for this coach (userId = coachId).
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  const db = getAdminDb();
  const snap = await db
    .collection("notifications")
    .where("userId", "==", coachId)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      type: data.type ?? "",
      title: data.title ?? "",
      message: data.message ?? "",
      actionUrl: data.actionUrl ?? null,
      metadata: data.metadata ?? null,
      isRead: data.isRead ?? false,
      createdAt: toDate(data.createdAt),
    };
  });
  return NextResponse.json(list);
}
