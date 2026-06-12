import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { evaluateAndAwardAchievements } from "@/lib/award-achievements";
import {
  isMeasurementDateInFuture,
  measurementDateKeyFromFirestore,
  parseMeasurementDateString,
  reconcileMeasurementBaselines,
} from "@/lib/client-measurements-server";
import { todayPerth } from "@/lib/perth-date";

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
    const dateKey = measurementDateKeyFromFirestore(data.date);
    return {
      id: d.id,
      date: dateKey,
      bodyWeight: data.bodyWeight,
      measurements: data.measurements ?? {},
      isBaseline: data.isBaseline ?? false,
      importedBeforeCheckinHUB: data.importedBeforeCheckinHUB ?? false,
    };
  });
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  let body: {
    date?: string;
    bodyWeight?: number;
    measurements?: Record<string, number>;
    importHistorical?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dateStr = (body.date ?? todayPerth()).trim();
  const date = parseMeasurementDateString(dateStr);
  if (!date) {
    return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
  }
  if (isMeasurementDateInFuture(dateStr)) {
    return NextResponse.json({ error: "Measurement date cannot be in the future" }, { status: 400 });
  }

  const hasWeight = body.bodyWeight != null && !Number.isNaN(body.bodyWeight);
  const hasMeasurements = body.measurements != null && Object.keys(body.measurements).length > 0;
  if (!hasWeight && !hasMeasurements) {
    return NextResponse.json(
      { error: "Add body weight and/or at least one measurement" },
      { status: 400 }
    );
  }

  const now = new Date();
  const todayKey = todayPerth();
  const importHistorical = body.importHistorical === true || dateStr < todayKey;

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

  const sameDay = snap.docs.find((d) => measurementDateKeyFromFirestore(d.data().date) === dateStr);

  if (sameDay) {
    const cur = sameDay.data();
    const payload: Record<string, unknown> = { updatedAt: now };
    if (hasWeight) payload.bodyWeight = body.bodyWeight;
    if (hasMeasurements) {
      payload.measurements = { ...(cur.measurements ?? {}), ...body.measurements };
    }
    if (importHistorical) payload.importedBeforeCheckinHUB = true;
    await sameDay.ref.update(payload);
    await reconcileMeasurementBaselines(db, clientId);
    const newlyEarned = await evaluateAndAwardAchievements(db, clientId);
    return NextResponse.json({ id: sameDay.id, ok: true, updated: true, newlyEarned });
  }

  const ref = await db.collection("client_measurements").add({
    clientId,
    date,
    bodyWeight: hasWeight ? body.bodyWeight : null,
    measurements: hasMeasurements ? body.measurements : {},
    isBaseline: false,
    ...(importHistorical ? { importedBeforeCheckinHUB: true } : {}),
    createdAt: now,
    updatedAt: now,
  });
  await reconcileMeasurementBaselines(db, clientId);
  const newlyEarned = await evaluateAndAwardAchievements(db, clientId);
  return NextResponse.json({ id: ref.id, ok: true, updated: false, newlyEarned });
}
