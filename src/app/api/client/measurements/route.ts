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

function dateKeyFromFirestore(dateVal: unknown): string | null {
  if (dateVal == null) return null;
  if (dateVal && typeof (dateVal as { toDate?: () => Date }).toDate === "function") {
    return (dateVal as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  if (dateVal instanceof Date) return dateVal.toISOString().slice(0, 10);
  return null;
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
  const date = new Date(dateStr + "T12:00:00.000Z");
  const now = new Date();

  if (!isAdminConfigured()) {
    return NextResponse.json({ id: "mock-measurement-1", ok: true, updated: false });
  }

  const db = getAdminDb();
  const snap = await db
    .collection("client_measurements")
    .where("clientId", "==", clientId)
    .orderBy("date", "desc")
    .limit(100)
    .get();

  const sameDay = snap.docs.find((d) => dateKeyFromFirestore(d.data().date) === dateStr);

  if (sameDay) {
    const cur = sameDay.data();
    const payload: Record<string, unknown> = { updatedAt: now };
    if (body.bodyWeight != null) payload.bodyWeight = body.bodyWeight;
    if (body.measurements != null && Object.keys(body.measurements).length > 0) {
      payload.measurements = { ...(cur.measurements ?? {}), ...body.measurements };
    }
    await sameDay.ref.update(payload);
    return NextResponse.json({ id: sameDay.id, ok: true, updated: true });
  }

  const ref = await db.collection("client_measurements").add({
    clientId,
    date,
    bodyWeight: body.bodyWeight ?? null,
    measurements: body.measurements ?? {},
    isBaseline: body.isBaseline ?? false,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ id: ref.id, ok: true, updated: false });
}
