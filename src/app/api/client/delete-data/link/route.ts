import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { isClosedClientStatus } from "@/lib/client-status";
import { buildDataDeletionLink, ensureDataDeletionToken } from "@/lib/client-data-deletion-token";
import { resolveAppBaseUrl } from "@/lib/app-url";

/** GET: authenticated closed client receives a one-time delete-my-data link. */
export async function GET(request: Request) {
  const authResult = await requireClient(request, { allowClosedAccount: true });
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const db = getAdminDb();
  const snap = await db.collection("clients").doc(clientId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const data = snap.data() as { status?: string };
  if (!isClosedClientStatus(data.status)) {
    return NextResponse.json(
      { error: "Data deletion is only available after your account has been closed." },
      { status: 400 }
    );
  }

  const tokenInfo = await ensureDataDeletionToken(db, clientId);
  if (!tokenInfo) {
    return NextResponse.json({ error: "Could not prepare deletion link." }, { status: 500 });
  }

  const deletionLink = buildDataDeletionLink(
    resolveAppBaseUrl(),
    tokenInfo.token,
    tokenInfo.email
  );
  return NextResponse.json({ deletionLink });
}
