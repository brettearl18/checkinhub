import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  const db = getAdminDb();
  const snap = await db
    .collection("clientGoals")
    .where("clientId", "==", clientId)
    .get();

  const list = snap.docs.map((d) => {
    const data = d.data();
    const deadline = data.deadline?.toDate?.() ?? data.deadline;
    return {
      id: d.id,
      title: data.title ?? "",
      description: data.description ?? "",
      category: data.category ?? "",
      targetValue: data.targetValue ?? 0,
      currentValue: data.currentValue ?? 0,
      unit: data.unit ?? "",
      deadline: deadline ? new Date(deadline).toISOString() : null,
      status: data.status ?? "active",
      progress: data.progress ?? 0,
    };
  });
  return NextResponse.json(list);
}
