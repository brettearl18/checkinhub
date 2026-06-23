import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/check-in-reminders-cron";
import { runClientDataRetentionPurges, runClientDataRetentionReminders } from "@/lib/client-data-retention-cron";
import { runPendingStripeCancellationClosures } from "@/lib/client-stripe-closure-cron";

/**
 * GET /api/cron/client-data-retention
 * Daily: Stripe cancellation grace, month-11 warnings, and 12-month data purges.
 */
export async function GET(request: Request) {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [stripeClosures, retentionReminders, retentionPurges] = await Promise.all([
    runPendingStripeCancellationClosures(),
    runClientDataRetentionReminders(),
    runClientDataRetentionPurges(),
  ]);
  return NextResponse.json({ stripeClosures, retentionReminders, retentionPurges });
}
