import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getStripe } from "@/lib/stripe-server";

/**
 * GET /api/coach/stripe/customer-lookup?customerId=cus_xxx
 * Returns Stripe customer name and email so the coach can confirm before saving.
 * Requires coach auth. STRIPE_SECRET_KEY must be set.
 */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId")?.trim();
  if (!customerId || !customerId.startsWith("cus_")) {
    return NextResponse.json(
      { error: "Valid Stripe Customer ID (cus_...) is required" },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return NextResponse.json({ error: "Customer no longer exists" }, { status: 404 });
    }
    const name =
      typeof customer.name === "string" ? customer.name : (customer.email ?? "").split("@")[0] ?? "";
    return NextResponse.json({
      id: customer.id,
      name: name || null,
      email: customer.email ?? null,
    });
  } catch (err: unknown) {
    const message = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (message === "resource_missing_not_found" || (err as { statusCode?: number }).statusCode === 404) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    console.error("Stripe customer lookup error:", err);
    return NextResponse.json(
      { error: "Could not look up customer" },
      { status: 502 }
    );
  }
}
