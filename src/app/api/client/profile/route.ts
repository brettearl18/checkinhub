import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      id: clientId,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      timezone: "Australia/Perth",
      profile: {},
      profilePersonalization: { quote: null, showQuote: false, colorTheme: "#daa450", icon: null },
      paymentStatus: null,
      mealPlanLinks: [],
    });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  const data = clientSnap.data()!;
  let mealPlanLinks = Array.isArray(data.mealPlanLinks)
    ? (data.mealPlanLinks as { label?: string; url?: string }[]).map((l) => ({
        label: l?.label ?? "",
        url: l?.url ?? "",
      }))
    : [];
  if (mealPlanLinks.length === 0 && data.mealPlanName && data.mealPlanUrl) {
    mealPlanLinks = [{ label: String(data.mealPlanName), url: String(data.mealPlanUrl) }];
  }
  const profile = {
    id: clientSnap.id,
    firstName: data.firstName ?? "",
    lastName: data.lastName ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    timezone: data.timezone ?? "",
    profile: data.profile ?? {},
    profilePersonalization: data.profilePersonalization ?? {
      quote: null,
      showQuote: false,
      colorTheme: "#daa450",
      icon: null,
    },
    paymentStatus: (data.paymentStatus as string) || null,
    mealPlanLinks,
  };
  return NextResponse.json(profile);
}

const ALLOWED_PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "timezone",
  "profile",
  "profilePersonalization",
  "emailNotifications",
] as const;

export async function PATCH(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ALLOWED_PROFILE_FIELDS) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  await db.collection("clients").doc(clientId).update(update);
  return NextResponse.json({ ok: true });
}
