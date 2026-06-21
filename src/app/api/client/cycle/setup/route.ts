import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { todayPerth } from "@/lib/perth-date";
import {
  computePhaseInfo,
  defaultCycleProfile,
  parseCycleRegularity,
  parsePeriodRecords,
  validateCycleSetup,
} from "@/lib/cycle-tracking";
import {
  backfillPeriodLogs,
  fetchCycleProfile,
  saveCycleProfile,
} from "@/lib/cycle-tracking-server";

/**
 * POST /api/client/cycle/setup
 * First-time setup: recent period, optional history, preferences.
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

  const lastPeriodStart = typeof body.lastPeriodStart === "string" ? body.lastPeriodStart.trim() : "";
  const lastPeriodEnd = typeof body.lastPeriodEnd === "string" ? body.lastPeriodEnd.trim() : "";
  const pastPeriods = parsePeriodRecords(body.pastPeriods);
  const averageCycleLength =
    body.averageCycleLength !== undefined ? Number(body.averageCycleLength) : undefined;
  const trackSexualActivity = Boolean(body.trackSexualActivity);
  const cycleRegularity = parseCycleRegularity(body.cycleRegularity);
  const onHormonalBirthControl =
    body.onHormonalBirthControl === true
      ? true
      : body.onHormonalBirthControl === false
        ? false
        : null;

  const validated = validateCycleSetup(
    {
      lastPeriodStart,
      lastPeriodEnd,
      pastPeriods,
      averageCycleLength,
      trackSexualActivity,
      cycleRegularity,
      onHormonalBirthControl,
    },
    today
  );
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const profilePatch = {
    setupCompleted: true,
    setupCompletedAt: today,
    lastPeriodStart,
    lastPeriodEnd,
    periodHistory: validated.periodHistory,
    averageCycleLength: validated.averageCycleLength,
    averagePeriodLength: validated.averagePeriodLength,
    computedCycleLengthMin: validated.computedCycleLengthMin,
    computedCycleLengthMax: validated.computedCycleLengthMax,
    trackSexualActivity,
    cycleRegularity,
    onHormonalBirthControl,
  };

  if (!isAdminConfigured()) {
    const profile = {
      ...defaultCycleProfile(clientId),
      trackingEnabled: true,
      ...profilePatch,
    };
    return NextResponse.json({
      ok: true,
      profile,
      phase: computePhaseInfo(profile, today),
    });
  }

  const db = getAdminDb();
  const existing = await fetchCycleProfile(db, clientId);
  if (!existing.trackingEnabled) {
    return NextResponse.json({ error: "Opt in to cycle tracking first" }, { status: 403 });
  }

  const profile = await saveCycleProfile(db, clientId, profilePatch);
  await backfillPeriodLogs(db, clientId, validated.periodHistory);

  return NextResponse.json({
    ok: true,
    profile,
    phase: computePhaseInfo(profile, today),
  });
}
