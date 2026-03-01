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

/**
 * GET /api/coach/payments
 * Returns all clients for the coach with payment fields for the Payment report.
 */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({ clients: [], stats: { paidUp: 0, behind: 0, notLinked: 0 } });
  }

  const db = getAdminDb();
  const snap = await db.collection("clients").where("coachId", "==", coachId).get();

  const clients = snap.docs.map((d) => {
    const data = d.data();
    const status = (data.status as string) ?? "active";
    const stripeCustomerId = (data.stripeCustomerId as string) || null;
    const paymentStatus = (data.paymentStatus as string) || null;
    return {
      id: d.id,
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? "",
      email: data.email ?? "",
      status,
      stripeCustomerId,
      paymentStatus,
      lastPaymentAt: toIso(data.lastPaymentAt),
      nextBillingAt: toIso(data.nextBillingAt),
    };
  });

  const nonArchived = clients.filter((c) => c.status !== "archived");
  const paidUp = nonArchived.filter((c) => c.paymentStatus === "paid").length;
  const behind = nonArchived.filter((c) =>
    c.paymentStatus === "failed" || c.paymentStatus === "past_due" || c.paymentStatus === "canceled"
  ).length;
  const notLinked = nonArchived.filter((c) => !c.stripeCustomerId).length;

  return NextResponse.json({
    clients: nonArchived,
    stats: { paidUp, behind, notLinked, total: nonArchived.length },
  });
}
