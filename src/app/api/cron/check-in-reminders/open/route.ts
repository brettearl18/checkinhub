import { NextResponse } from "next/server";
import { requireCronSecret, runReminders } from "@/lib/check-in-reminders-cron";

/**
 * GET /api/cron/check-in-reminders/open
 * Vercel Cron: Friday 02:00 UTC = 10:00 Perth. Sends "Check In is now Open" (in-app + push + email).
 */
export async function GET(request: Request) {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runReminders("open");
  return NextResponse.json(result);
}
