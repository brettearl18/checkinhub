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
    .collection("client_measurements")
    .where("clientId", "==", clientId)
    .orderBy("date", "desc")
    .limit(100)
    .get();

  const list = snap.docs.map((d) => {
    const data = d.data();
    const date = data.date?.toDate?.() ?? data.date;
    return {
      id: d.id,
      date: date ? new Date(date).toISOString().slice(0, 10) : null,
      bodyWeight: data.bodyWeight,
      measurements: data.measurements ?? {},
      isBaseline: data.isBaseline ?? false,
    };
  });
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  let body: { date?: string; bodyWeight?: number; measurements?: Record<string, number>; isBaseline?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dateStr = body.date ?? new Date().toISOString().slice(0, 10);
  const date = new Date(dateStr);
  const now = new Date();

  if (!isAdminConfigured()) {
    return NextResponse.json({ id: "mock-measurement-1", ok: true });
  }

  const db = getAdminDb();
  const ref = await db.collection("client_measurements").add({
    clientId,
    date,
    bodyWeight: body.bodyWeight ?? null,
    measurements: body.measurements ?? {},
    isBaseline: body.isBaseline ?? false,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ id: ref.id, ok: true });
}
