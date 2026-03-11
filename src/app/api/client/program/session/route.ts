import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

/** GET: session by week and day (client). Query: ?week=1&day=0 */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get("week");
  const dayParam = searchParams.get("day");
  const weekIndex = weekParam ? parseInt(weekParam, 10) : 1;
  const dayIndex = dayParam ? parseInt(dayParam, 10) : 0;
  if (Number.isNaN(weekIndex) || Number.isNaN(dayIndex) || weekIndex < 1 || dayIndex < 0) {
    return NextResponse.json({ error: "week (1-based) and day (0-based) required" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({
      programName: "",
      weekIndex,
      dayIndex,
      session: { weekLabel: `Week ${weekIndex}`, dayLabel: `Day ${dayIndex + 1}`, blocks: [] },
    });
  }

  const assignment = await getAdminDb().collection("client_programs").doc(clientId).get();
  if (!assignment.exists) {
    return NextResponse.json({ error: "No program assigned" }, { status: 404 });
  }
  const data = assignment.data()!;
  if (data.status === "completed") {
    return NextResponse.json({ error: "Program completed" }, { status: 404 });
  }

  const snapshot = data.programSnapshot as { days: { name?: string; blocks: unknown[] }[] }[] | undefined;
  if (!Array.isArray(snapshot) || snapshot.length === 0) {
    return NextResponse.json({ error: "Program has no weeks" }, { status: 404 });
  }
  const week = snapshot[weekIndex - 1];
  if (!week || !Array.isArray(week.days) || dayIndex >= week.days.length) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const day = week.days[dayIndex];
  return NextResponse.json({
    programName: data.programName,
    startDate: typeof data.startDate === "string" ? data.startDate : null,
    weekIndex,
    dayIndex,
    session: {
      weekLabel: `Week ${weekIndex}`,
      dayLabel: day.name || `Day ${dayIndex + 1}`,
      blocks: day.blocks ?? [],
    },
  });
}
