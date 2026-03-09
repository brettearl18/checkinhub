import { NextResponse } from "next/server";
import { requireCronSecret, runReminders } from "@/lib/check-in-reminders-cron";

/**
 * GET /api/cron/check-in-reminders/closing
 * Vercel Cron: Monday 09:00 UTC = 17:00 Perth. Sends closing reminder (in-app + push + email).
 */
export async function GET(request: Request) {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runReminders("closing");
  return NextResponse.json(result);
}
