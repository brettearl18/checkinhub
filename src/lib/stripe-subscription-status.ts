import type Stripe from "stripe";

export type StripeSubscriptionAccountStatus = "active" | "paused" | "cancelled";

/**
 * Coach-facing subscription state (not the same as invoice paymentStatus).
 * Paused = pause_collection on an otherwise active Stripe subscription.
 */
export function deriveStripeSubscriptionAccountStatus(
  sub: Stripe.Subscription | null | undefined
): StripeSubscriptionAccountStatus | null {
  if (!sub) return null;

  const status = sub.status;
  if (
    status === "canceled" ||
    status === "unpaid" ||
    status === "incomplete_expired"
  ) {
    return "cancelled";
  }

  const pause = sub.pause_collection;
  if (pause && typeof pause === "object" && pause.behavior) {
    return "paused";
  }

  if (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "incomplete" ||
    status === "paused"
  ) {
    return status === "paused" ? "paused" : "active";
  }

  return "cancelled";
}

export function subscriptionAccountStatusLabel(
  status: StripeSubscriptionAccountStatus | null | undefined
): string {
  if (!status) return "Unknown";
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  return "Cancelled";
}
