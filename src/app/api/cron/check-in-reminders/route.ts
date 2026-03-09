import { NextResponse } from "next/server";
import { requireCronSecret, runReminders } from "@/lib/check-in-reminders-cron";

/**
 * GET /api/cron/check-in-reminders?type=open|closing
 * For Vercel Cron (sends GET). Same auth: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const typeParam = new URL(request.url).searchParams.get("type");
  const type = typeParam === "open" || typeParam === "closing" ? typeParam : null;
  if (!type) {
    return NextResponse.json({ error: "Query must include type=open or type=closing" }, { status: 400 });
  }
  const result = await runReminders(type);
  return NextResponse.json(result);
}

/**
 * POST /api/cron/check-in-reminders
 * Body: { "type": "open" | "closing" }
 * Headers: Authorization: Bearer <CRON_SECRET> or x-cron-secret: <CRON_SECRET>
 *
 * - open: Friday 10am Perth – "Check In is now Open" for clients with an assignment (reflectionWeekStart = next Monday).
 * - closing: Monday 5pm Perth – closing reminder (optional).
 */
export async function POST(request: Request) {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const type = body.type === "open" || body.type === "closing" ? body.type : null;
  if (!type) {
    return NextResponse.json({ error: "Body must include type: 'open' or 'closing'" }, { status: 400 });
  }
  const result = await runReminders(type);
  return NextResponse.json(result);
}
