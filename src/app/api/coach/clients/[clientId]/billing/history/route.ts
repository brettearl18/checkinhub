import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe-server";

/**
 * GET /api/coach/clients/[clientId]/billing/history
 * Returns Stripe invoice list for this client (customer). Coach-only; client must belong to coach.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

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
    return NextResponse.json({
      clientId,
      customerId: null,
      invoices: [],
      message: "No Stripe customer linked",
    });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  try {
    const list = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 100,
    });

    const invoices = (list.data ?? []).map((inv) => ({
      id: inv.id,
      number: inv.number ?? null,
      status: inv.status ?? null,
      amountPaid: inv.amount_paid ?? 0,
      amountDue: inv.amount_due ?? 0,
      currency: inv.currency ?? "aud",
      created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      dueDate: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
      paid: inv.paid ?? false,
      invoicePdf: inv.invoice_pdf ?? null,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    }));

    return NextResponse.json({
      clientId,
      customerId: stripeCustomerId,
      invoices,
    });
  } catch (err) {
    console.error("[billing/history]", err);
    return NextResponse.json(
      { error: "Failed to load payment history" },
      { status: 502 }
    );
  }
}
