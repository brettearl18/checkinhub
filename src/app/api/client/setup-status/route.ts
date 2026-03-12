import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

/**
 * GET /api/client/setup-status
 * Returns whether the client has completed first-time setup: baseline measurement, progress photo, push notifications.
 */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { clientId, uid } = authResult.identity;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      hasBaselineMeasurement: false,
      hasProgressPhoto: false,
      hasPushEnabled: false,
    });
  }

  const db = getAdminDb();

  const [baselineSnap, photosSnap, pushSnap] = await Promise.all([
    db
      .collection("client_measurements")
      .where("clientId", "==", clientId!)
      .where("isBaseline", "==", true)
      .limit(1)
      .get(),
    db
      .collection("progress_images")
      .where("clientId", "==", clientId!)
      .limit(1)
      .get(),
    db
      .collection("pushTokens")
      .where("userId", "==", uid)
      .limit(1)
      .get(),
  ]);

  return NextResponse.json({
    hasBaselineMeasurement: !baselineSnap.empty,
    hasProgressPhoto: !photosSnap.empty,
    hasPushEnabled: !pushSnap.empty,
  });
}
