import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { todayPerth } from "@/lib/perth-date";
import { addCalendarDays, computePhaseInfo, stripCoachVisibleCycleLog } from "@/lib/cycle-tracking";
import { fetchCycleLogsForOwners, fetchCycleProfile } from "@/lib/cycle-tracking-server";

/**
 * GET /api/coach/clients/[clientId]/cycle
 * Read-only cycle summary when the client has opted in to share with coach.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;
  const today = todayPerth();

  if (!isAdminConfigured()) {
    return NextResponse.json({
      shared: false,
      reason: "not_opted_in",
    });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const clientData = clientSnap.data() as { coachId?: string; authUid?: string };
  if (clientData.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await fetchCycleProfile(db, clientId);
  if (!profile.shareWithCoach || !profile.trackingEnabled) {
    return NextResponse.json({
      shared: false,
      reason: "not_opted_in",
    });
  }

  const ownerIds = [clientId];
  if (typeof clientData.authUid === "string" && clientData.authUid.trim()) {
    ownerIds.push(clientData.authUid.trim());
  }

  const logs = await fetchCycleLogsForOwners(db, ownerIds, 30);
  const recentLogs = logs
    .filter((l) => l.date >= addCalendarDays(today, -13))
    .map((l) => {
      const safe = stripCoachVisibleCycleLog(l);
      return {
        date: safe.date,
        mood: safe.mood ?? null,
        energy: safe.energy ?? null,
        symptoms: safe.symptoms ?? [],
        feelings: safe.feelings ?? [],
        isPeriodDay: Boolean(safe.isPeriodDay),
        periodFlow: safe.periodFlow ?? null,
        ...(profile.shareNotesWithCoach && safe.note ? { note: safe.note } : {}),
      };
    });

  const moodValues = recentLogs.map((l) => l.mood).filter((v): v is number => typeof v === "number");
  const energyValues = recentLogs.map((l) => l.energy).filter((v): v is number => typeof v === "number");
  const avg = (values: number[]) =>
    values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

  return NextResponse.json({
    shared: true,
    profile: {
      averageCycleLength: profile.averageCycleLength,
      averagePeriodLength: profile.averagePeriodLength,
      lastPeriodStart: profile.lastPeriodStart,
      lastPeriodEnd: profile.lastPeriodEnd,
      shareNotesWithCoach: profile.shareNotesWithCoach,
    },
    phase: computePhaseInfo(profile, today),
    summary: {
      avgMood7d: avg(moodValues),
      avgEnergy7d: avg(energyValues),
      daysLogged: recentLogs.length,
    },
    recentLogs,
  });
}
