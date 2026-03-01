# How This Project Is Linked to Stripe

This document describes how CHECKINV5 is connected to Stripe: environment, data link, webhook, and app features. For full setup steps and testing, see **`STRIPE_PAYMENT_STATUS.md`**.

---

## 1. Summary

- **Link:** Each client in Firestore can have a **Stripe Customer ID** stored as `stripeCustomerId`. That one field ties the client to Stripe.
- **No Stripe.js on the front end.** All Stripe calls use the **secret key** on the server (API routes). There is no `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in this project.
- **Webhook:** Stripe sends payment/subscription events to our app; we find the client by `stripeCustomerId` and update `paymentStatus`, `lastPaymentAt`, `nextBillingAt`, `stripeSubscriptionId` on the client doc.

---

## 2. Environment Variables

| Variable | Where | Purpose |
|----------|--------|--------|
| **`STRIPE_SECRET_KEY`** | `.env.local` / Cloud Run | Server-side Stripe API (customer lookup, subscription pause/resume/cancel, billing sync, invoice list). From Stripe Dashboard → API keys (`sk_test_...` or `sk_live_...`). |
| **`STRIPE_WEBHOOK_SECRET`** | `.env.local` / Cloud Run | Verify webhook requests (signature). From Stripe Dashboard → Webhooks → your endpoint → Signing secret (`whsec_...`). |

Neither is committed. Add them to `.env.local` and to your deployment (e.g. Cloud Run env vars).

---

## 3. Data Link: Client ↔ Stripe

- **Firestore:** `clients` collection. Each client document may have:
  - **`stripeCustomerId`** (string | null) – Stripe Customer ID (e.g. `cus_xxx`). This is the only required link.
  - **`stripeSubscriptionId`** (string | null) – Set by the webhook when we receive subscription events; used for pause/resume/cancel.
  - **`paymentStatus`** – `'paid' | 'past_due' | 'failed' | 'canceled' | null` – Set by the webhook (and by the billing sync API).
  - **`lastPaymentAt`**, **`nextBillingAt`** – Set by webhook / sync.

- **Linking a client to Stripe** means: create (or reuse) a Stripe Customer, then set that client’s `stripeCustomerId` in Firestore to that Customer ID. Subscription can be created in Stripe Dashboard or via your own process; the app does not create customers or subscriptions itself.

---

## 4. Where the Link Is Set (in this app)

1. **Coach UI – Client Settings → Billing**
   - Coach enters a Stripe Customer ID (e.g. copy from Stripe Dashboard).
   - “Connect” calls **`GET /api/stripe/customer-lookup?customerId=...`** to verify the customer exists and show name/email.
   - Saving client settings sends the ID to the client update API; the client doc is updated with **`stripeCustomerId`** (and optionally other settings).

2. **Manually in Firestore**
   - Edit the client document and set `stripeCustomerId` to the Stripe Customer ID.

3. **External / script**
   - When you create a Stripe Customer elsewhere, write the same ID to the client’s `stripeCustomerId` in Firestore.

The app does **not** create Stripe Customers or Checkout sessions; it only stores and uses the Customer ID you provide.

---

## 5. Webhook (Stripe → App)

- **URL:** `https://checkinv5.web.app/api/webhooks/stripe` (or your production base URL + `/api/webhooks/stripe`).
- **Handler:** `src/app/api/webhooks/stripe/route.ts`
- **Verification:** Uses `STRIPE_WEBHOOK_SECRET` to verify the `Stripe-Signature` header. No auth token; signature is the only check.
- **Events:** `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- **Behaviour:** For each event we get a Stripe Customer ID from the payload. We query Firestore: `clients` where `stripeCustomerId == that customer id`, then update that client doc with `paymentStatus`, `lastPaymentAt`, `nextBillingAt`, `stripeSubscriptionId` as appropriate.

So: **Stripe pushes payment/subscription state into our DB** via the webhook; the “link” is the lookup by `stripeCustomerId`.

---

## 6. Server-Side Stripe Usage (this repo)

| File / route | Purpose |
|--------------|--------|
| **`src/lib/stripe-server.ts`** | `getStripe()` (singleton from `STRIPE_SECRET_KEY`), `resolveSubscriptionForClient(clientId)` (get subscription from Firestore or by listing Stripe subscriptions for the client’s `stripeCustomerId`). |
| **`src/app/api/webhooks/stripe/route.ts`** | Receive Stripe events; update client `paymentStatus`, `lastPaymentAt`, `nextBillingAt`, `stripeSubscriptionId`. |
| **`src/app/api/stripe/customer-lookup/route.ts`** | GET/POST with `customerId`; returns Stripe customer name/email so coach can confirm before saving `stripeCustomerId`. |
| **`src/app/api/clients/[id]/billing/sync/route.ts`** | POST; one-off sync from Stripe into Firestore for that client (e.g. after adding webhook later). |
| **`src/app/api/clients/[id]/billing/history/route.ts`** | GET; list invoices for the client’s Stripe customer (for Payment tab). |
| **`src/app/api/clients/[id]/billing/pause-subscription/route.ts`** | POST; pause subscription (optional `resumesAt`). |
| **`src/app/api/clients/[id]/billing/resume-subscription/route.ts`** | POST; resume subscription. |
| **`src/app/api/clients/[id]/billing/cancel-subscription/route.ts`** | POST; cancel (option: at period end or immediately). |

All billing APIs require coach auth and that the client belongs to the coach. They use `getStripe()` and therefore require `STRIPE_SECRET_KEY`.

---

## 7. UI Surfaces

- **Client profile (coach):** Header and Payment tab show payment status and “View payment history” when the client has `stripeCustomerId`. Settings → Billing: input for Stripe Customer ID, “Connect” (customer lookup), and Pause / Resume / Cancel subscription when the client has an active subscription.
- **Payment report:** Lists clients with Stripe link and status (uses same `clients` fields: `stripeCustomerId`, `paymentStatus`, etc.).

---

## 8. Quick Reference

| What | Where |
|------|--------|
| Env vars | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (no publishable key) |
| Link field | `clients.stripeCustomerId` |
| Webhook URL | `{BASE_URL}/api/webhooks/stripe` |
| How to link | Coach enters Customer ID in Settings → Billing, or set `stripeCustomerId` in Firestore / your backend |
| Full setup & testing | `docs/STRIPE_PAYMENT_STATUS.md` |

This is how we’ve linked this project to Stripe: **env keys + client doc field + webhook + server-only API routes.**
