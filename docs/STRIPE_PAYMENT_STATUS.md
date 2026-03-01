# Stripe payment status integration

This lets you show whether a client is **paid up** or **payment has failed** (or past due / canceled) in the coach app, using Stripe webhooks and optional weekly subscriptions.

## How it works

1. **Link a client to Stripe**  
   When you create a Stripe Customer (or subscription) for a client, set the client’s `stripeCustomerId` in Firestore to that Stripe Customer ID (e.g. `cus_xxx`).

2. **Stripe sends events to your app**  
   You register a webhook URL in the Stripe Dashboard. Stripe sends events (e.g. `invoice.paid`, `invoice.payment_failed`) to that URL.

3. **Webhook updates the client**  
   The app’s webhook handler verifies the request, finds the client by `stripeCustomerId`, and updates:
   - `paymentStatus`: `'paid' | 'past_due' | 'failed' | 'canceled' | null`
   - `lastPaymentAt`, `nextBillingAt`, `stripeSubscriptionId` when relevant.

   **Portal, Dashboard, or app:** Stripe sends the same events whether the change is made in the **Stripe Customer Billing Portal** (client self-serve), the **Stripe Dashboard**, or from our app (e.g. coach pause/cancel). So pausing, canceling, or updating a subscription in the portal is reflected in the app as soon as the webhook runs.

4. **Coach UI**  
   The client profile page shows a “Payment: Paid up” or “Payment: Failed” (etc.) badge when the client has Stripe data. A **Payment** tab shows subscription/program details and full **payment history** (invoices from Stripe).

## Setup

### 1. Environment variables

Add to `.env.local` and to Cloud Run (and any other deployment) env:

- **`STRIPE_WEBHOOK_SECRET`** (required for webhook)  
  From Stripe Dashboard → Webhooks → your endpoint → “Signing secret” (starts with `whsec_`).

- **`STRIPE_SECRET_KEY`** (required for pause/cancel from the app)  
  From Stripe Dashboard → API keys (e.g. `sk_live_...` or `sk_test_...`). Needed so coaches can **pause**, **resume**, or **cancel** a client’s subscription from Client Settings → Billing. You do **not** need it for the webhook alone.

### 2. Stripe Dashboard – webhook endpoint (configure at production launch)

The webhook handler is implemented at `POST /api/webhooks/stripe`. When you launch to production:

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks).
2. **Add endpoint** (or “Create event destination” in Workbench).
3. **Endpoint URL:**  
   `https://<your-production-domain>/api/webhooks/stripe`
4. **Events to send:**  
   - `invoice.paid`  
   - `invoice.payment_failed`  
   - `customer.subscription.updated`  
   - `customer.subscription.deleted`  
5. Save and copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET`.

### 3. Link clients to Stripe

For each client you bill in Stripe:

- Create a Stripe Customer (and optionally a Subscription with weekly billing).
- In your app/Firestore, set on the client document:
  - `stripeCustomerId`: the Stripe Customer ID (e.g. `cus_xxx`).

You can do this:

- Manually in Firestore (clients collection, field `stripeCustomerId`), or  
- From your own backend/script when you create the Stripe customer, or  
- Later by adding a “Connect Stripe” flow in the app that creates the customer and saves `stripeCustomerId`.

### 4. Firestore

The webhook looks up the client by `clients.stripeCustomerId`. Single-field equality queries do not require an extra index in Firestore.

## Allocating weekly payment / “paid up” vs “failed”

- **Paid up:** Stripe has sent `invoice.paid` (or subscription is `active`), and the webhook has set `paymentStatus: 'paid'` and `lastPaymentAt` on the client.
- **Payment failed:** Stripe has sent `invoice.payment_failed`, and the webhook has set `paymentStatus: 'failed'`.
- **Past due / Canceled:** Handled via `customer.subscription.updated` and `customer.subscription.deleted` (e.g. `paymentStatus: 'past_due'` or `'canceled'`). These events are sent when a subscription is paused, resumed, canceled, or updated (e.g. from the Stripe Customer Portal or Dashboard), so the app stays in sync.

So “allocate a client’s weekly payment” in your workflow is:

1. Create Stripe Customer (and weekly subscription) for the client.
2. Set the client’s `stripeCustomerId` in Firestore.
3. Rely on the webhook to keep `paymentStatus` and related fields in sync so the app can show “paid up” or “payment failed” (and other states) in the UI.

## Testing

- Use [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and trigger test events.
- Use the signing secret printed by `stripe listen` as `STRIPE_WEBHOOK_SECRET` for local testing.

## Pause or cancel a subscription from the app

When a client has a Stripe Customer ID (and an active subscription), coaches can:

- **Pause subscription** – Stops payment collection (invoices are voided until you resume). Optional: send a `resumesAt` date in the request body to auto-resume.
- **Resume subscription** – Turns collection back on after a pause.
- **Cancel subscription** – Either at the end of the current billing period (recommended) or immediately.

**Where:** Client profile → **Settings** → **Billing / Stripe** section. Buttons appear when the client has a Stripe Customer ID saved.

**APIs (used by the UI):**

- `POST /api/clients/[id]/billing/pause-subscription` – optional body: `{ "resumesAt": "2026-03-01T00:00:00.000Z" }`
- `POST /api/clients/[id]/billing/resume-subscription`
- `POST /api/clients/[id]/billing/cancel-subscription` – optional body: `{ "cancelAtPeriodEnd": true }` (default) or `false` for immediate cancel

All require coach auth and that the client belongs to the coach. `STRIPE_SECRET_KEY` must be set for these to work.

## Security

- The webhook handler verifies the `Stripe-Signature` header using `STRIPE_WEBHOOK_SECRET`; only Stripe (with that secret) can trigger updates.
- No auth token is required for the webhook URL; verification is by signature only.
- Pause/resume/cancel endpoints require an authenticated coach and verify the client’s `coachId` matches the current user.
