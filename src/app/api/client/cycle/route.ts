import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { todayPerth } from "@/lib/perth-date";
import {
  addCalendarDays,
  computePhaseInfo,
  defaultCycleProfile,
  isValidYyyyMmDd,
  parseCycleRegularity,
} from "@/lib/cycle-tracking";
import { fetchCycleLogsForClient, fetchCycleProfile, saveCycleProfile } from "@/lib/cycle-tracking-server";

/**
 * GET /api/client/cycle
 * Profile, estimated phase, today's log, and recent daily logs.
 */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const today = todayPerth();

  if (!isAdminConfigured()) {
    const profile = defaultCycleProfile(clientId);
    return NextResponse.json({
      profile,
      phase: computePhaseInfo(profile, today),
      todayLog: null,
      recentLogs: [],
      calendarLogs: [],
    });
  }

  const db = getAdminDb();
  const profile = await fetchCycleProfile(db, clientId);
  const logs = await fetchCycleLogsForClient(db, clientId, 120);
  const todayLog = logs.find((l) => l.date === today) ?? null;
  const recentLogs = logs.filter((l) => l.date >= addCalendarDays(today, -13));
  const calendarLogs = logs.filter((l) => l.date >= addCalendarDays(today, -90));

  return NextResponse.json({
    profile,
    phase: computePhaseInfo(profile, today),
    todayLog,
    recentLogs,
    calendarLogs,
  });
}

/**
 * PATCH /api/client/cycle
 * Update tracking settings, coach sharing opt-in, or log period start.
 */
export async function PATCH(request: Request) {
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

  let existing = defaultCycleProfile(clientId);
  if (isAdminConfigured()) {
    existing = await fetchCycleProfile(getAdminDb(), clientId);
  }
  const patch: Record<string, unknown> = {};

  if (typeof body.trackingEnabled === "boolean") {
    patch.trackingEnabled = body.trackingEnabled;
    if (body.trackingEnabled) {
      patch.optedInAt = today;
    } else {
      patch.shareWithCoach = false;
      patch.shareNotesWithCoach = false;
    }
  }

  if (typeof body.shareWithCoach === "boolean") {
    if (body.shareWithCoach && !existing.trackingEnabled && patch.trackingEnabled !== true) {
      return NextResponse.json({ error: "Opt in to cycle tracking before sharing with your coach" }, { status: 400 });
    }
    patch.shareWithCoach = body.shareWithCoach;
    if (!body.shareWithCoach) {
      patch.shareNotesWithCoach = false;
    }
  }

  if (typeof body.shareNotesWithCoach === "boolean") {
    if (body.shareNotesWithCoach && !existing.trackingEnabled && patch.trackingEnabled !== true) {
      return NextResponse.json({ error: "Opt in to cycle tracking before sharing with your coach" }, { status: 400 });
    }
    patch.shareNotesWithCoach = body.shareNotesWithCoach;
  }

  if (body.averageCycleLength !== undefined) {
    const n = Number(body.averageCycleLength);
    if (!Number.isFinite(n) || n < 21 || n > 45) {
      return NextResponse.json({ error: "averageCycleLength must be 21–45" }, { status: 400 });
    }
    patch.averageCycleLength = Math.round(n);
  }

  if (body.averagePeriodLength !== undefined) {
    const n = Number(body.averagePeriodLength);
    if (!Number.isFinite(n) || n < 2 || n > 14) {
      return NextResponse.json({ error: "averagePeriodLength must be 2–14" }, { status: 400 });
    }
    patch.averagePeriodLength = Math.round(n);
  }

  if (body.lastPeriodEnd !== undefined) {
    const willBeEnabled = patch.trackingEnabled === true || existing.trackingEnabled;
    if (!willBeEnabled) {
      return NextResponse.json({ error: "Opt in to cycle tracking before logging your period" }, { status: 400 });
    }
    const raw = typeof body.lastPeriodEnd === "string" ? body.lastPeriodEnd.trim() : "";
    if (raw === "") {
      patch.lastPeriodEnd = null;
    } else {
      if (!isValidYyyyMmDd(raw)) {
        return NextResponse.json({ error: "lastPeriodEnd must be YYYY-MM-DD" }, { status: 400 });
      }
      if (raw > today) {
        return NextResponse.json({ error: "Period end cannot be in the future" }, { status: 400 });
      }
      patch.lastPeriodEnd = raw;
    }
  }

  if (body.lastPeriodStart !== undefined) {
    const willBeEnabled = patch.trackingEnabled === true || existing.trackingEnabled;
    if (!willBeEnabled) {
      return NextResponse.json({ error: "Opt in to cycle tracking before logging your period" }, { status: 400 });
    }
    const raw = typeof body.lastPeriodStart === "string" ? body.lastPeriodStart.trim() : "";
    if (raw === "") {
      patch.lastPeriodStart = null;
    } else {
      if (!isValidYyyyMmDd(raw)) {
        return NextResponse.json({ error: "lastPeriodStart must be YYYY-MM-DD" }, { status: 400 });
      }
      if (raw > today) {
        return NextResponse.json({ error: "Period start cannot be in the future" }, { status: 400 });
      }
      const oldest = addCalendarDays(today, -729);
      if (raw < oldest) {
        return NextResponse.json({ error: "Date is too far in the past" }, { status: 400 });
      }
      patch.lastPeriodStart = raw;
    }
  }

  if (typeof body.trackSexualActivity === "boolean") {
    patch.trackSexualActivity = body.trackSexualActivity;
  }

  if (body.cycleRegularity !== undefined) {
    if (body.cycleRegularity === null || body.cycleRegularity === "") {
      patch.cycleRegularity = null;
    } else {
      const regularity = parseCycleRegularity(body.cycleRegularity);
      if (!regularity) {
        return NextResponse.json({ error: "Invalid cycleRegularity" }, { status: 400 });
      }
      patch.cycleRegularity = regularity;
    }
  }

  if (body.onHormonalBirthControl !== undefined) {
    if (body.onHormonalBirthControl === null) {
      patch.onHormonalBirthControl = null;
    } else if (typeof body.onHormonalBirthControl === "boolean") {
      patch.onHormonalBirthControl = body.onHormonalBirthControl;
    } else {
      return NextResponse.json({ error: "Invalid onHormonalBirthControl" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    const profile = { ...defaultCycleProfile(clientId), ...patch, clientId };
    return NextResponse.json({
      profile,
      phase: computePhaseInfo(profile as ReturnType<typeof defaultCycleProfile>, today),
    });
  }

  const db = getAdminDb();
  const profile = await saveCycleProfile(db, clientId, patch as Parameters<typeof saveCycleProfile>[2]);

  return NextResponse.json({
    profile,
    phase: computePhaseInfo(profile, today),
  });
}
