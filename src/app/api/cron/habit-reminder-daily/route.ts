import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/check-in-reminders-cron";
import { runHabitRemindersPerth } from "@/lib/habit-reminder-cron";

/**
 * GET /api/cron/habit-reminder-daily
 * Vercel Cron: 0 11 * * * (11:00 UTC daily) = 19:00 Australia/Perth.
 * In-app + push: remind to log habits; skips clients who already logged all habits today (Perth).
 */
export async function GET(request: Request) {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runHabitRemindersPerth();
  return NextResponse.json(result);
}
