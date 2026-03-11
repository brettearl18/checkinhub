import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

/** Monday 00:00 UTC for date string YYYY-MM-DD */
function parseMonday(s: string): Date {
  const d = new Date(s + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/** Week index (1-based) and day index (0=Mon..6=Sun) for today relative to startDate (Monday YYYY-MM-DD). */
function getTodayWeekAndDay(startDate: string): { weekIndex: number; dayIndex: number } {
  const start = parseMonday(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const todayMs = today.getTime();
  const diffDays = Math.floor((todayMs - startMs) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { weekIndex: 1, dayIndex: 0 };
  const weekIndex = Math.floor(diffDays / 7) + 1;
  const dayIndex = diffDays % 7; // 0=Mon, 6=Sun
  return { weekIndex, dayIndex };
}

/** GET: today's session (client). Returns session for current week/day or null. */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json(null);
  }

  const assignment = await getAdminDb().collection("client_programs").doc(clientId).get();
  if (!assignment.exists) {
    return NextResponse.json(null);
  }
  const data = assignment.data()!;
  if (data.status === "completed") {
    return NextResponse.json(null);
  }
  const startDate = typeof data.startDate === "string" ? data.startDate : (data.startDate as { toDate?: () => Date })?.toDate?.()?.toISOString()?.slice(0, 10);
  if (!startDate) return NextResponse.json(null);

  const snapshot = data.programSnapshot as { days: { name?: string; blocks: unknown[] }[] }[] | undefined;
  if (!Array.isArray(snapshot) || snapshot.length === 0) return NextResponse.json(null);

  const { weekIndex, dayIndex } = getTodayWeekAndDay(startDate);
  const week = snapshot[weekIndex - 1];
  if (!week || !Array.isArray(week.days) || dayIndex >= week.days.length) {
    return NextResponse.json({
      programName: data.programName,
      startDate,
      weekIndex,
      dayIndex,
      session: null,
      message: "No session scheduled for today.",
    });
  }

  const day = week.days[dayIndex];
  return NextResponse.json({
    programName: data.programName,
    startDate,
    weekIndex,
    dayIndex,
    session: {
      weekLabel: `Week ${weekIndex}`,
      dayLabel: day.name || `Day ${dayIndex + 1}`,
      blocks: day.blocks ?? [],
    },
  });
}
