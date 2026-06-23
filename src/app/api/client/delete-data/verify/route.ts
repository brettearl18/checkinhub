import { NextResponse } from "next/server";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { verifyDataDeletionToken } from "@/lib/client-data-deletion-token";

/** POST: verify data-deletion link token + email. */
export async function POST(request: Request) {
  let body: { token?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!token || !email) {
    return NextResponse.json({ error: "Token and email are required." }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  }

  const db = getAdminDb();
  const verified = await verifyDataDeletionToken(db, token, email);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 404 });
  }

  return NextResponse.json({
    clientId: verified.clientId,
    firstName: verified.firstName,
    email: verified.email,
  });
}
