import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

// GET: client profile + settings for coach (for settings page).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      timezone: "",
      status: "active",
      trafficLightRedMax: 40,
      trafficLightOrangeMax: 70,
      programStartDate: "",
      programDurationWeeks: null as number | null,
      checkInFrequency: "weekly",
      communicationPreference: "email",
      coachNotes: "",
      stripeCustomerId: null as string | null,
      paymentStatus: null as string | null,
      lastPaymentAt: null,
      nextBillingAt: null,
      firstPaymentAt: null,
      mealPlanLinks: [],
    });
  }

  const db = getAdminDb();
  const [clientSnap, scoringSnap] = await Promise.all([
    db.collection("clients").doc(clientId).get(),
    db.collection("clientScoring").doc(clientId).get(),
  ]);
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const data = clientSnap.data() as {
    coachId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    timezone?: string;
    status?: string;
    profile?: { preferences?: { checkInFrequency?: string; communication?: string } };
    programStartDate?: string;
    programDurationWeeks?: number;
    coachNotes?: string;
    stripeCustomerId?: string | null;
    paymentStatus?: string | null;
    lastPaymentAt?: unknown;
    nextBillingAt?: unknown;
    firstPaymentAt?: unknown;
    mealPlanLinks?: { label?: string; url?: string }[];
  };
  if (data.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scoring = scoringSnap.exists ? scoringSnap.data() as { thresholds?: { red?: number[]; orange?: number[]; green?: number[] } } : {};
  const th = scoring.thresholds ?? {};
  const redMax = Array.isArray(th.red) && th.red[1] != null ? th.red[1] : 40;
  const orangeMax = Array.isArray(th.orange) && th.orange[1] != null ? th.orange[1] : 70;

  let firstPaymentAt: string | null = toIso(data.firstPaymentAt) ?? null;

  // Backfill firstPaymentAt from Stripe when missing (e.g. client linked before webhook)
  if (data.stripeCustomerId && !firstPaymentAt) {
    const { getStripe } = await import("@/lib/stripe-server");
    const stripe = getStripe();
    if (stripe) {
      try {
        const list = await stripe.invoices.list({
          customer: data.stripeCustomerId as string,
          status: "paid",
          limit: 100,
        });
        let earliest: number | null = null;
        for (const inv of list.data ?? []) {
          const t = inv.status_transitions?.paid_at ?? inv.created;
          if (typeof t === "number" && (earliest == null || t < earliest)) earliest = t;
        }
        if (earliest != null) {
          const date = new Date(earliest * 1000);
          firstPaymentAt = date.toISOString();
          await clientSnap.ref.update({ firstPaymentAt: date, updatedAt: new Date() });
        }
      } catch {
        // ignore
      }
    }
  }

  return NextResponse.json({
    firstName: data.firstName ?? "",
    lastName: data.lastName ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    timezone: data.timezone ?? "",
    status: data.status ?? "active",
    trafficLightRedMax: redMax,
    trafficLightOrangeMax: orangeMax,
    programStartDate: data.programStartDate ?? "",
    programDurationWeeks: data.programDurationWeeks ?? null,
    checkInFrequency: data.profile?.preferences?.checkInFrequency ?? "weekly",
    communicationPreference: data.profile?.preferences?.communication ?? "email",
    coachNotes: data.coachNotes ?? "",
    stripeCustomerId: data.stripeCustomerId ?? null,
    paymentStatus: data.paymentStatus ?? null,
    lastPaymentAt: toIso(data.lastPaymentAt) ?? null,
    nextBillingAt: toIso(data.nextBillingAt) ?? null,
    firstPaymentAt,
    mealPlanLinks: Array.isArray(data.mealPlanLinks)
      ? data.mealPlanLinks.map((l) => ({ label: l?.label ?? "", url: l?.url ?? "" }))
      : [],
  });
}

const CLIENT_ALLOWED = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "timezone",
  "status",
  "programStartDate",
  "programDurationWeeks",
  "checkInFrequency",
  "communicationPreference",
  "coachNotes",
  "stripeCustomerId",
  "mealPlanLinks",
] as const;

// PATCH: update client profile and settings (coach only).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  const snap = await db.collection("clients").doc(clientId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if ((snap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const clientUpdate: Record<string, unknown> = { updatedAt: now };

  if (body.firstName !== undefined) clientUpdate.firstName = body.firstName;
  if (body.lastName !== undefined) clientUpdate.lastName = body.lastName;
  if (body.email !== undefined) clientUpdate.email = body.email;
  if (body.phone !== undefined) clientUpdate.phone = body.phone;
  if (body.timezone !== undefined) clientUpdate.timezone = body.timezone;
  if (body.status !== undefined) clientUpdate.status = body.status;
  if (body.programStartDate !== undefined) clientUpdate.programStartDate = body.programStartDate;
  if (body.programDurationWeeks !== undefined) clientUpdate.programDurationWeeks = body.programDurationWeeks;
  if (body.coachNotes !== undefined) clientUpdate.coachNotes = body.coachNotes;
  if (body.stripeCustomerId !== undefined) clientUpdate.stripeCustomerId = body.stripeCustomerId === "" || body.stripeCustomerId == null ? null : body.stripeCustomerId;
  if (body.mealPlanLinks !== undefined) {
    const raw = body.mealPlanLinks;
    clientUpdate.mealPlanLinks = Array.isArray(raw)
      ? raw
          .filter((l) => l && typeof l === "object" && (l as { url?: string }).url)
          .map((l) => ({
            label: typeof (l as { label?: string }).label === "string" ? (l as { label: string }).label : "",
            url: String((l as { url?: string }).url ?? ""),
          }))
      : [];
  }

  if (body.checkInFrequency !== undefined || body.communicationPreference !== undefined) {
    const data = snap.data() as { profile?: Record<string, unknown> };
    const profile = data?.profile ?? {};
    const prefs = (profile.preferences as Record<string, unknown>) ?? {};
    if (body.checkInFrequency !== undefined) prefs.checkInFrequency = body.checkInFrequency;
    if (body.communicationPreference !== undefined) prefs.communication = body.communicationPreference;
    clientUpdate.profile = { ...profile, preferences: prefs };
  }

  await db.collection("clients").doc(clientId).update(clientUpdate);

  const redMax = typeof body.trafficLightRedMax === "number" ? body.trafficLightRedMax : undefined;
  const orangeMax = typeof body.trafficLightOrangeMax === "number" ? body.trafficLightOrangeMax : undefined;
  if (redMax !== undefined || orangeMax !== undefined) {
    const r = redMax ?? 40;
    const o = orangeMax ?? 70;
    const thresholds = {
      red: [0, r] as [number, number],
      orange: [r + 1, o] as [number, number],
      green: [o + 1, 100] as [number, number],
    };
    await db.collection("clientScoring").doc(clientId).set(
      { clientId, thresholds, updatedAt: now },
      { merge: true }
    );
  }

  return NextResponse.json({ ok: true });
}
