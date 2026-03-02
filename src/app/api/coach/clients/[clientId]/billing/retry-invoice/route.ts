import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe-server";

/**
 * POST /api/coach/clients/[clientId]/billing/retry-invoice
 * Body: { invoiceId: string }
 * Attempts to pay a failed/unpaid Stripe invoice for this client. Coach-only; invoice must belong to client's Stripe customer.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  let body: { invoiceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId.trim() : null;
  if (!invoiceId || !invoiceId.startsWith("in_")) {
    return NextResponse.json({ error: "invoiceId required (e.g. in_...)" }, { status: 400 });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const data = clientSnap.data() as { coachId?: string; stripeCustomerId?: string };
  if (data.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stripeCustomerId = data.stripeCustomerId;
  if (!stripeCustomerId) {
    return NextResponse.json({ error: "Client has no Stripe customer linked" }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.customer !== stripeCustomerId) {
      return NextResponse.json({ error: "Invoice does not belong to this client" }, { status: 403 });
    }
    if (invoice.paid) {
      return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
    }
    await stripe.invoices.pay(invoiceId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Payment failed";
    console.error("[billing/retry-invoice]", err);
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
