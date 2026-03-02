import { NextResponse } from "next/server";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate();
  try {
    return new Date(String(v));
  } catch {
    return null;
  }
}

/** POST: verify onboarding token + email. Returns client name if valid; used by invite link page. */
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
    return NextResponse.json({ error: "Invalid or expired link. Please ask your coach for a new invite." }, { status: 404 });
  }

  const db = getAdminDb();
  const clientsSnap = await db
    .collection("clients")
    .where("onboardingToken", "==", token)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (clientsSnap.empty) {
    return NextResponse.json({ error: "Invalid or expired link. Please ask your coach for a new invite." }, { status: 404 });
  }

  const doc = clientsSnap.docs[0];
  const data = doc.data() as {
    status?: string;
    tokenExpiry?: unknown;
    firstName?: string;
    lastName?: string;
  };

  if (data.status === "active") {
    return NextResponse.json({ error: "This invite has already been used. You can sign in." }, { status: 400 });
  }

  const expiry = toDate(data.tokenExpiry);
  if (expiry && expiry.getTime() < Date.now()) {
    return NextResponse.json({ error: "This invite link has expired. Please ask your coach for a new one." }, { status: 400 });
  }

  const firstName = data.firstName ?? "";
  const lastName = data.lastName ?? "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || email;

  return NextResponse.json({
    clientId: doc.id,
    firstName,
    lastName,
    displayName,
    email,
  });
}
