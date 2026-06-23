import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { isClosedClientStatus } from "@/lib/client-status";
import { verifyDataDeletionToken } from "@/lib/client-data-deletion-token";
import { purgeClientData } from "@/lib/purge-client-data";

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

/** POST: authenticated client confirms last name and permanently deletes their data. */
export async function POST(request: Request) {
  const authResult = await requireClient(request, { allowClosedAccount: true });
  if ("error" in authResult) return authResult.error;
  const authClientId = authResult.identity.clientId!;

  let body: { token?: string; email?: string; lastName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  if (!token || !email || !lastName) {
    return NextResponse.json({ error: "Token, email, and last name are required." }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  const verified = await verifyDataDeletionToken(db, token, email);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }
  if (verified.clientId !== authClientId) {
    return NextResponse.json(
      { error: "Please sign in with the email address this link was sent to." },
      { status: 403 }
    );
  }

  const clientSnap = await db.collection("clients").doc(authClientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const clientData = clientSnap.data() as { status?: string; lastName?: string };
  if (!isClosedClientStatus(clientData.status)) {
    return NextResponse.json(
      { error: "Only closed accounts can be deleted through this link." },
      { status: 400 }
    );
  }

  const storedLastName = typeof clientData.lastName === "string" ? clientData.lastName : "";
  if (normalizeName(storedLastName) !== normalizeName(lastName)) {
    return NextResponse.json({ error: "Last name does not match our records." }, { status: 400 });
  }

  try {
    await purgeClientData(db, authClientId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[client/delete-data]", err);
    return NextResponse.json({ error: "Could not delete your data. Please contact support." }, { status: 500 });
  }
}
