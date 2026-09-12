import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email-service";
import { isClosedClientStatus, normalizeClientStatusForApi, normalizeClientStatusForStorage } from "@/lib/client-status";
import { FieldValue } from "firebase-admin/firestore";
import {
  closeClientAccount,
  hasActiveUpfrontPackage,
  reactivateClientAccount,
} from "@/lib/client-account-closure";
import type { ClientBadgeAwardMode } from "@/lib/badge-approval";
import { resolveThresholds, SCORING_PROFILES, type ScoringProfileId } from "@/lib/scoring-utils";

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
      heightCm: null as number | null,
      timezone: "",
      status: "active",
      trafficLightRedMax: 60,
      trafficLightOrangeMax: 85,
      scoringProfile: null as string | null,
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
      mealPlanJson: null as Record<string, unknown> | null,
      packagePaidAt: null as string | null,
      packageMonths: null as number | null,
      packageFreeWeeks: 0,
      packageExpiresAt: null as string | null,
      badgeAwardMode: "default" as ClientBadgeAwardMode,
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
    heightCm?: number | null;
    timezone?: string;
    status?: string;
    profile?: { preferences?: { checkInFrequency?: string; communication?: string } };
    programStartDate?: string;
    programDurationWeeks?: number;
    coachNotes?: string;
    stripeCustomerId?: string | null;
    paymentStatus?: string | null;
    stripeSubscriptionStatus?: string | null;
    lastPaymentAt?: unknown;
    nextBillingAt?: unknown;
    firstPaymentAt?: unknown;
    mealPlanLinks?: { label?: string; url?: string }[];
    mealPlanJson?: Record<string, unknown> | null;
    mealPlanName?: string;
    mealPlanUrl?: string;
    packagePaidAt?: unknown;
    packageMonths?: number | null;
    packageFreeWeeks?: number | null;
    badgeAwardMode?: ClientBadgeAwardMode;
  };
  if (data.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scoringData = scoringSnap.exists
    ? (scoringSnap.data() as { thresholds?: { redMax?: number; orangeMax?: number }; scoringProfile?: string })
    : null;
  const { redMax, orangeMax } = resolveThresholds({ clientScoring: scoringData ?? undefined });
  const scoringProfile = scoringData?.scoringProfile ?? null;

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

  const { parseHeightCm, isValidHeightCm } = await import("@/lib/client-height");
  const heightCm = parseHeightCm(data.heightCm);

  return NextResponse.json({
    firstName: data.firstName ?? "",
    lastName: data.lastName ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    heightCm: isValidHeightCm(heightCm) ? heightCm : null,
    timezone: data.timezone ?? "",
    status: normalizeClientStatusForApi(data.status ?? "active"),
    trafficLightRedMax: redMax,
    trafficLightOrangeMax: orangeMax,
    scoringProfile: scoringProfile,
    programStartDate: data.programStartDate ?? "",
    programDurationWeeks: data.programDurationWeeks ?? null,
    checkInFrequency: data.profile?.preferences?.checkInFrequency ?? "weekly",
    communicationPreference: data.profile?.preferences?.communication ?? "email",
    coachNotes: data.coachNotes ?? "",
    stripeCustomerId: data.stripeCustomerId ?? null,
    paymentStatus: data.paymentStatus ?? null,
    stripeSubscriptionStatus: data.stripeSubscriptionStatus ?? null,
    lastPaymentAt: toIso(data.lastPaymentAt) ?? null,
    nextBillingAt: toIso(data.nextBillingAt) ?? null,
    firstPaymentAt,
    mealPlanLinks: (() => {
      const links = Array.isArray(data.mealPlanLinks)
        ? data.mealPlanLinks.map((l) => ({ label: l?.label ?? "", url: l?.url ?? "" }))
        : [];
      if (links.length > 0) return links;
      const name = data.mealPlanName ?? "";
      const url = data.mealPlanUrl ?? "";
      if (name && url) return [{ label: name, url }];
      return [];
    })(),
    mealPlanJson:
      data.mealPlanJson && typeof data.mealPlanJson === "object" && !Array.isArray(data.mealPlanJson)
        ? (data.mealPlanJson as Record<string, unknown>)
        : null,
    packagePaidAt: toIso(data.packagePaidAt) ?? null,
    packageMonths: typeof data.packageMonths === "number" ? data.packageMonths : null,
    packageFreeWeeks: typeof data.packageFreeWeeks === "number" ? data.packageFreeWeeks : 0,
    badgeAwardMode:
      data.badgeAwardMode === "auto" || data.badgeAwardMode === "coach"
        ? data.badgeAwardMode
        : ("default" as ClientBadgeAwardMode),
    packageExpiresAt: (() => {
      const paid = toIso(data.packagePaidAt);
      const months = typeof data.packageMonths === "number" ? data.packageMonths : null;
      const weeks = typeof data.packageFreeWeeks === "number" ? data.packageFreeWeeks : 0;
      if (!paid || months == null) return null;
      const d = new Date(paid);
      if (Number.isNaN(d.getTime())) return null;
      d.setMonth(d.getMonth() + months);
      d.setDate(d.getDate() + weeks * 7);
      return d.toISOString().slice(0, 10);
    })(),
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

  const clientBefore = snap.data() as {
    firstName?: string;
    email?: string;
    status?: string;
  };
  const previousStatus = normalizeClientStatusForApi(clientBefore.status);
  const now = new Date();
  const clientUpdate: Record<string, unknown> = { updatedAt: now };

  if (body.firstName !== undefined) clientUpdate.firstName = body.firstName;
  if (body.lastName !== undefined) clientUpdate.lastName = body.lastName;
  if (body.email !== undefined) clientUpdate.email = body.email;
  if (body.phone !== undefined) clientUpdate.phone = body.phone;
  if (body.heightCm !== undefined) {
    if (body.heightCm === null || body.heightCm === "") {
      clientUpdate.heightCm = null;
    } else {
      const { normalizeHeightCmInput } = await import("@/lib/client-height");
      const normalized = normalizeHeightCmInput(body.heightCm);
      if (!normalized.ok) {
        return NextResponse.json({ error: normalized.error }, { status: 400 });
      }
      clientUpdate.heightCm = normalized.heightCm;
    }
  }
  if (body.timezone !== undefined) clientUpdate.timezone = body.timezone;
  if (body.status !== undefined && typeof body.status === "string") {
    clientUpdate.status = normalizeClientStatusForStorage(body.status);
  }
  if (body.programStartDate !== undefined) clientUpdate.programStartDate = body.programStartDate;
  if (body.programDurationWeeks !== undefined) clientUpdate.programDurationWeeks = body.programDurationWeeks;
  if (body.coachNotes !== undefined) clientUpdate.coachNotes = body.coachNotes;
  if (body.stripeCustomerId !== undefined) {
    const clearing =
      body.stripeCustomerId === "" || body.stripeCustomerId == null;
    if (clearing) {
      // Unlink Stripe: clear ID and subscription lock fields so package clients can use the portal.
      clientUpdate.stripeCustomerId = null;
      clientUpdate.stripeSubscriptionId = FieldValue.delete();
      clientUpdate.stripeSubscriptionStatus = FieldValue.delete();
      clientUpdate.stripeCancellationPendingAt = FieldValue.delete();
      const afterPackage = {
        ...snap.data(),
        ...(body.packagePaidAt !== undefined
          ? {
              packagePaidAt:
                body.packagePaidAt === "" || body.packagePaidAt == null
                  ? null
                  : new Date(body.packagePaidAt as string),
            }
          : {}),
        ...(body.packageMonths !== undefined
          ? {
              packageMonths:
                body.packageMonths === "" ||
                body.packageMonths == null ||
                (typeof body.packageMonths === "number" &&
                  (body.packageMonths < 1 || body.packageMonths > 120))
                  ? null
                  : Number(body.packageMonths),
            }
          : {}),
        ...(body.packageFreeWeeks !== undefined
          ? {
              packageFreeWeeks:
                typeof body.packageFreeWeeks === "number" && body.packageFreeWeeks >= 0
                  ? body.packageFreeWeeks
                  : 0,
            }
          : {}),
      } as Record<string, unknown>;
      clientUpdate.paymentStatus = hasActiveUpfrontPackage(afterPackage)
        ? "paid"
        : FieldValue.delete();
    } else {
      clientUpdate.stripeCustomerId = String(body.stripeCustomerId).trim();
    }
  }
  if (body.packagePaidAt !== undefined) {
    const v = body.packagePaidAt;
    clientUpdate.packagePaidAt = v === "" || v == null ? null : new Date(v as string);
  }
  if (body.packageMonths !== undefined) {
    const v = body.packageMonths;
    clientUpdate.packageMonths = v === "" || v == null || (typeof v === "number" && (v < 1 || v > 120)) ? null : Number(v);
  }
  if (body.packageFreeWeeks !== undefined) {
    const v = body.packageFreeWeeks;
    clientUpdate.packageFreeWeeks = typeof v === "number" && v >= 0 ? v : 0;
  }

  // Saving an active upfront package while Stripe shows cancelled: lift portal suspension.
  const packageTouched =
    body.packagePaidAt !== undefined ||
    body.packageMonths !== undefined ||
    body.packageFreeWeeks !== undefined;
  if (packageTouched && body.stripeCustomerId === undefined) {
    const merged = {
      ...snap.data(),
      ...clientUpdate,
    } as Record<string, unknown>;
    if (hasActiveUpfrontPackage(merged)) {
      clientUpdate.stripeCancellationPendingAt = FieldValue.delete();
      if (
        (merged.stripeSubscriptionStatus as string | undefined) === "cancelled" ||
        (merged.paymentStatus as string | undefined) === "canceled"
      ) {
        clientUpdate.paymentStatus = "paid";
      }
    }
  }
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
  if (body.mealPlanJson !== undefined) {
    const raw = body.mealPlanJson;
    clientUpdate.mealPlanJson =
      raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  }
  if (body.badgeAwardMode !== undefined) {
    const mode = body.badgeAwardMode;
    if (mode === "default" || mode === "auto" || mode === "coach") {
      clientUpdate.badgeAwardMode = mode;
    }
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

  const newStatus =
    body.status !== undefined && typeof body.status === "string"
      ? normalizeClientStatusForApi(normalizeClientStatusForStorage(body.status))
      : previousStatus;
  const justCancelled =
    newStatus === "cancelled" && !isClosedClientStatus(clientBefore.status);
  if (justCancelled) {
    await closeClientAccount(db, clientId);
  }

  const justReactivated =
    newStatus === "active" && isClosedClientStatus(clientBefore.status);
  if (justReactivated) {
    await reactivateClientAccount(db, clientId, { coachReactivation: true });
  }

  const sendMealPlanEmail = body.sendMealPlanEmail === true && body.mealPlanLinks !== undefined;
  const newMealPlanLinks = Array.isArray(body.mealPlanLinks)
    ? (body.mealPlanLinks as { label?: string; url?: string }[]).filter((l) => l?.url)
    : [];
  if (sendMealPlanEmail && newMealPlanLinks.length > 0) {
    const clientData = snap.data() as { email?: string; firstName?: string; status?: string };
    const toEmail = clientData?.email?.trim();
    if (toEmail && !isClosedClientStatus(clientData.status)) {
      const firstName = clientData.firstName?.trim() || "there";
      const planLabel = newMealPlanLinks[0]?.label || "Meal plan";
      const planUrl = newMealPlanLinks[0]?.url || "";
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
      const clientPortal = baseUrl ? `${baseUrl.replace(/\/$/, "")}/client` : "/client";
      await sendEmail({
        to: toEmail,
        subject: "Your meal plan has been updated",
        html: `
          <p>Hi ${firstName},</p>
          <p>Your coach has updated your meal plan.</p>
          <p><strong>${planLabel}</strong></p>
          <p><a href="${planUrl}" style="display:inline-block;background:#c9a227;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;">View meal plan</a></p>
          <p><a href="${planUrl}">${planUrl}</a></p>
          ${newMealPlanLinks.length > 1 ? `<p>You have ${newMealPlanLinks.length} meal plan links in your portal.</p>` : ""}
          <p><a href="${clientPortal}">Open your CheckinHUB portal</a></p>
          <p>Best,<br>CheckinHUB</p>
        `.trim(),
        text: `Hi ${firstName},\n\nYour coach has updated your meal plan: ${planLabel}\n${planUrl}\n\nBest,\nCheckinHUB`,
      });
    }
  }

  const redMax = typeof body.trafficLightRedMax === "number" ? body.trafficLightRedMax : undefined;
  const orangeMax = typeof body.trafficLightOrangeMax === "number" ? body.trafficLightOrangeMax : undefined;
  const scoringProfile = typeof body.scoringProfile === "string" && body.scoringProfile ? (body.scoringProfile as ScoringProfileId) : undefined;
  if (redMax !== undefined || orangeMax !== undefined || scoringProfile !== undefined) {
    const profileDef = scoringProfile && SCORING_PROFILES[scoringProfile];
    const r = redMax ?? profileDef?.redMax ?? 60;
    const o = orangeMax ?? profileDef?.orangeMax ?? 85;
    const thresholds = {
      red: [0, r] as [number, number],
      orange: [r + 1, o] as [number, number],
      green: [o + 1, 100] as [number, number],
      redMax: r,
      orangeMax: o,
    };
    await db.collection("clientScoring").doc(clientId).set(
      {
        clientId,
        thresholds,
        ...(scoringProfile !== undefined && { scoringProfile }),
        updatedAt: now,
      },
      { merge: true }
    );
  }

  return NextResponse.json({ ok: true });
}
