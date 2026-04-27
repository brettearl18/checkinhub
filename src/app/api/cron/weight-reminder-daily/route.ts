import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/check-in-reminders-cron";
import { runWeightRemindersPerth } from "@/lib/weight-reminder-cron";

/**
 * GET /api/cron/weight-reminder-daily
 * Vercel Cron: 0 23 * * * (23:00 UTC daily) = 07:00 Australia/Perth.
 * In-app + push: remind to log body weight; skips clients who already logged today (Perth).
 */
export async function GET(request: Request) {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runWeightRemindersPerth();
  return NextResponse.json(result);
}
