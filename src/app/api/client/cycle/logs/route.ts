import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { todayPerth } from "@/lib/perth-date";
import {
  addCalendarDays,
  CYCLE_FEELING_OPTIONS,
  CYCLE_SYMPTOM_OPTIONS,
  clampRating,
  isValidYyyyMmDd,
  sanitizePeriodFlow,
  sanitizeStringList,
} from "@/lib/cycle-tracking";
import { fetchCycleProfile, saveCycleProfile, upsertCycleDailyLog } from "@/lib/cycle-tracking-server";

const SYMPTOM_IDS = CYCLE_SYMPTOM_OPTIONS.map((o) => o.id);
const FEELING_IDS = CYCLE_FEELING_OPTIONS.map((o) => o.id);

/**
 * POST /api/client/cycle/logs
 * Upsert a daily mood / energy / symptom log.
 */
export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const today = todayPerth();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let entryDate = today;
  if (body.date !== undefined && body.date !== null && body.date !== "") {
    const raw = typeof body.date === "string" ? body.date.trim() : "";
    if (!isValidYyyyMmDd(raw)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    if (raw > today) {
      return NextResponse.json({ error: "Cannot log for a future date" }, { status: 400 });
    }
    const oldest = addCalendarDays(today, -729);
    if (raw < oldest) {
      return NextResponse.json({ error: "Date is too far in the past" }, { status: 400 });
    }
    entryDate = raw;
  }

  const mood = body.mood === null ? null : clampRating(body.mood);
  const energy = body.energy === null ? null : clampRating(body.energy);
  if (body.mood !== undefined && body.mood !== null && mood === null) {
    return NextResponse.json({ error: "mood must be 1–5" }, { status: 400 });
  }
  if (body.energy !== undefined && body.energy !== null && energy === null) {
    return NextResponse.json({ error: "energy must be 1–5" }, { status: 400 });
  }

  const symptoms = sanitizeStringList(body.symptoms, SYMPTOM_IDS);
  const feelings = sanitizeStringList(body.feelings, FEELING_IDS);
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 500) : body.note === null ? null : undefined;
  const isPeriodDay = typeof body.isPeriodDay === "boolean" ? body.isPeriodDay : undefined;
  const periodFlow =
    body.periodFlow === null ? null : body.periodFlow !== undefined ? sanitizePeriodFlow(body.periodFlow) : undefined;

  if (body.periodFlow !== undefined && body.periodFlow !== null && periodFlow === null) {
    return NextResponse.json({ error: "Invalid periodFlow" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.mood !== undefined) patch.mood = mood;
  if (body.energy !== undefined) patch.energy = energy;
  if (body.symptoms !== undefined) patch.symptoms = symptoms;
  if (body.feelings !== undefined) patch.feelings = feelings;
  if (note !== undefined) patch.note = note || null;
  if (isPeriodDay !== undefined) patch.isPeriodDay = isPeriodDay;
  if (periodFlow !== undefined) patch.periodFlow = periodFlow;

  if (body.sexualActivity !== undefined || body.sexualActivityProtected !== undefined) {
    if (body.sexualActivity === null) {
      patch.sexualActivity = null;
      patch.sexualActivityProtected = null;
    } else if (typeof body.sexualActivity === "boolean") {
      patch.sexualActivity = body.sexualActivity;
      if (!body.sexualActivity) {
        patch.sexualActivityProtected = null;
      } else if (body.sexualActivityProtected !== undefined) {
        patch.sexualActivityProtected =
          body.sexualActivityProtected === null
            ? null
            : typeof body.sexualActivityProtected === "boolean"
              ? body.sexualActivityProtected
              : null;
      }
    } else if (body.sexualActivity !== undefined) {
      return NextResponse.json({ error: "sexualActivity must be true, false, or null" }, { status: 400 });
    } else if (body.sexualActivityProtected !== undefined) {
      patch.sexualActivityProtected =
        body.sexualActivityProtected === null
          ? null
          : typeof body.sexualActivityProtected === "boolean"
            ? body.sexualActivityProtected
            : null;
      if (patch.sexualActivityProtected !== null && typeof patch.sexualActivityProtected !== "boolean") {
        return NextResponse.json({ error: "sexualActivityProtected must be true, false, or null" }, { status: 400 });
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No log fields provided" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({
      ok: true,
      log: { clientId, date: entryDate, ...patch },
    });
  }

  const db = getAdminDb();
  const profile = await fetchCycleProfile(db, clientId);

  if (!profile.trackingEnabled) {
    return NextResponse.json(
      { error: "Opt in to cycle tracking before logging mood or period data" },
      { status: 403 }
    );
  }

  if (!profile.setupCompleted) {
    return NextResponse.json(
      { error: "Complete cycle setup before logging daily data" },
      { status: 403 }
    );
  }

  if (
    (body.sexualActivity !== undefined || body.sexualActivityProtected !== undefined) &&
    !profile.trackSexualActivity
  ) {
    return NextResponse.json(
      { error: "Enable sexual activity logging in cycle settings first" },
      { status: 400 }
    );
  }

  if (isPeriodDay === true && entryDate) {
    await saveCycleProfile(db, clientId, {
      lastPeriodStart: entryDate,
    });
  }

  const log = await upsertCycleDailyLog(db, clientId, entryDate, patch);

  return NextResponse.json({ ok: true, log });
}
