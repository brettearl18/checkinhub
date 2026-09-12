import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { isValidHeightCm, parseHeightCm } from "@/lib/client-height";

/**
 * GET /api/client/setup-status
 * Returns whether the client has completed first-time setup:
 * baseline measurement, progress photo, push notifications, height.
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
      hasHeight: false,
    });
  }

  const db = getAdminDb();

  const [measurementsSnap, photosSnap, pushSnap, clientSnap] = await Promise.all([
    db
      .collection("client_measurements")
      .where("clientId", "==", clientId!)
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
    db.collection("clients").doc(clientId!).get(),
  ]);

  const heightCm = parseHeightCm(clientSnap.data()?.heightCm);

  return NextResponse.json({
    hasBaselineMeasurement: !measurementsSnap.empty,
    hasProgressPhoto: !photosSnap.empty,
    hasPushEnabled: !pushSnap.empty,
    hasHeight: isValidHeightCm(heightCm),
  });
}
