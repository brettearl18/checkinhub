import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { evaluateAndAwardAchievements } from "@/lib/award-achievements";
import {
  isMeasurementDateInFuture,
  measurementDateKeyFromFirestore,
  parseMeasurementDateString,
  reconcileMeasurementBaselines,
} from "@/lib/client-measurements-server";
import { todayPerth } from "@/lib/perth-date";

async function safeReconcileAndAward(db: ReturnType<typeof getAdminDb>, clientId: string) {
  try {
    await reconcileMeasurementBaselines(db, clientId);
  } catch (err) {
    console.error("[client/measurements/[id]] reconcile baselines failed", clientId, err);
  }
  try {
    await evaluateAndAwardAchievements(db, clientId);
  } catch (err) {
    console.error("[client/measurements/[id]] award achievements failed", clientId, err);
  }
}

/**
 * PATCH /api/client/measurements/[id]
 * Update an existing measurement entry (date, weight, tape) — full replace of measurements object.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const { id } = await params;

  let body: {
    date?: string;
    bodyWeight?: number | null;
    measurements?: Record<string, number>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  const ref = db.collection("client_measurements").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Measurement not found" }, { status: 404 });
  }
  const existing = snap.data()!;
  if (existing.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload: Record<string, unknown> = { updatedAt: new Date() };

  if (body.date !== undefined) {
    const dateStr = String(body.date).trim();
    const date = parseMeasurementDateString(dateStr);
    if (!date) {
      return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
    }
    if (isMeasurementDateInFuture(dateStr)) {
      return NextResponse.json({ error: "Measurement date cannot be in the future" }, { status: 400 });
    }

    // Avoid two entries on the same calendar day for this client.
    const currentKey = measurementDateKeyFromFirestore(existing.date);
    if (dateStr !== currentKey) {
      const others = await db
        .collection("client_measurements")
        .where("clientId", "==", clientId)
        .orderBy("date", "desc")
        .limit(100)
        .get();
      const clash = others.docs.find(
        (d) => d.id !== id && measurementDateKeyFromFirestore(d.data().date) === dateStr
      );
      if (clash) {
        return NextResponse.json(
          { error: "Another entry already exists on that date. Edit that one instead." },
          { status: 409 }
        );
      }
    }
    payload.date = date;
    if (dateStr < todayPerth()) {
      payload.importedBeforeCheckinHUB = true;
    }
  }

  if (body.bodyWeight !== undefined) {
    if (body.bodyWeight == null) {
      payload.bodyWeight = null;
    } else if (typeof body.bodyWeight === "number" && !Number.isNaN(body.bodyWeight)) {
      payload.bodyWeight = body.bodyWeight;
    } else {
      return NextResponse.json({ error: "Invalid body weight" }, { status: 400 });
    }
  }

  if (body.measurements !== undefined) {
    if (body.measurements == null || typeof body.measurements !== "object") {
      payload.measurements = {};
    } else {
      const cleaned: Record<string, number> = {};
      for (const [key, value] of Object.entries(body.measurements)) {
        if (typeof value === "number" && !Number.isNaN(value)) cleaned[key] = value;
      }
      payload.measurements = cleaned;
    }
  }

  const nextWeight =
    payload.bodyWeight !== undefined
      ? (payload.bodyWeight as number | null)
      : (existing.bodyWeight as number | null | undefined) ?? null;
  const nextMeasurements =
    (payload.measurements as Record<string, number> | undefined) ??
    ((existing.measurements as Record<string, number>) ?? {});
  if (nextWeight == null && Object.keys(nextMeasurements).length === 0) {
    return NextResponse.json(
      { error: "Keep weight and/or at least one body measurement" },
      { status: 400 }
    );
  }

  try {
    await ref.update(payload);
    await safeReconcileAndAward(db, clientId);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[client/measurements/[id] PATCH]", err);
    return NextResponse.json({ error: "Could not update measurement." }, { status: 500 });
  }
}
