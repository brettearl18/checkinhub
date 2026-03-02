import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

const PUSH_TOKENS_COLLECTION = "pushTokens";

/**
 * POST /api/client/push-subscribe
 * Body: { token: string }
 * Stores the FCM registration token for the authenticated client (by userId) so we can send push notifications.
 */
export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.identity.uid;

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true, message: "Database not configured" });
  }

  const db = getAdminDb();
  const tokenId = token.slice(0, 50) + "_" + Buffer.from(token).toString("base64").slice(-20);
  const docId = tokenId.replace(/[^a-zA-Z0-9_-]/g, "_");

  await db.collection(PUSH_TOKENS_COLLECTION).doc(docId).set(
    {
      userId,
      token,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
