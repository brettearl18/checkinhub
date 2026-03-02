# Push notifications (Web Push)

CheckinHUB can send **phone-style push notifications** to clients (e.g. “Your check-in is open”, “Your check-in is closing today”). Notifications appear in the system tray and can open the app when tapped.

---

## How it works

- **Web Push** via Firebase Cloud Messaging (FCM). No native iOS/Android app required.
- **Android:** Works in Chrome (and other supported browsers). Notifications show in the status bar.
- **iPhone:** Supported from **iOS 16.4** only when the site is **added to Home Screen** (PWA). In Safari without “Add to Home Screen”, push is not available.

Clients enable notifications from **Client portal → Notifications** (“Enable push notifications”). The app stores their FCM token and, when the cron runs (check-in open / closing), sends both an in-app notification and a push to all of that user’s registered devices.

---

## Setup

### 1. Firebase Cloud Messaging

1. **Firebase Console** → your project → **Project settings** (gear) → **Cloud Messaging**.
2. Under **Web Push certificates**, click **Generate key pair** (or use an existing one).
3. Copy the **public key** and set it in your env. The app reads **`NEXT_PUBLIC_FIREBASE_VAPID_KEY`** or **`NEXT_PUBLIC_VAPID_PUBLIC_KEY`** (so you can use your existing VAPID public key: set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the same value as `VAPID_PUBLIC_KEY` so the client bundle can access it). See VERCEL_DEPLOYMENT.md.

### 2. Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` or `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Yes, for push | Web Push **public** key (must be `NEXT_PUBLIC_*` so the client can use it). If you already have `VAPID_PUBLIC_KEY`, set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the same value. |
| `NEXT_PUBLIC_APP_URL` | Yes, for links | Used as the base URL when the user taps the notification (e.g. open `/client/check-in/new`). |

Other Firebase client vars (API key, project ID, etc.) must already be set.

### 3. Firestore

The app stores FCM tokens in a collection **`pushTokens`** with documents:

- `userId` (string): auth UID of the client
- `token` (string): FCM registration token
- `updatedAt` (timestamp)

Create a **single-field index** on `userId` if Firestore prompts you when the first query runs.

### 4. PWA icons (optional)

For a better experience (and for “Add to Home Screen” on iOS), add to **`public/`**:

- **`icon-192.png`** (192×192)
- **`icon-512.png`** (512×512)

The manifest and service worker reference these. If missing, notifications still work; the system may use a default icon.

---

## What’s implemented

- **Service worker** at `/firebase-messaging-sw.js` (served via rewrite with your Firebase config). Handles background messages and notification click (opens the app at the link).
- **PWA manifest** at `/manifest.json` (or equivalent) for name, theme, and icons.
- **Client:** “Enable push notifications” on the **Notifications** page. Registers the SW, gets the FCM token, sends it to `POST /api/client/push-subscribe`.
- **Cron:** When `POST /api/cron/check-in-reminders` runs with `type: "open"` or `"closing"`, it creates in-app notifications and calls the push helper to send the same message to each user’s FCM tokens. Response includes `pushSent`.

---

## Testing

1. Deploy with `NEXT_PUBLIC_FIREBASE_VAPID_KEY` and `NEXT_PUBLIC_APP_URL` set.
2. As a client, go to **Notifications** and click **Enable push notifications**. Allow when the browser prompts.
3. Trigger the cron manually, e.g.  
   `curl -X POST "https://your-app/api/cron/check-in-reminders" -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" -d '{"type":"open"}'`  
   (only for users who have an open check-in for the relevant week).
4. You should see an in-app notification and, if the client has enabled push and the device supports it, a system notification. Tapping it should open the app at the check-in page.

---

## Troubleshooting

- **No push on iPhone:** User must **Add to Home Screen** and open the app from the home screen icon (iOS 16.4+).
- **Token not saved:** Check that `POST /api/client/push-subscribe` returns 200 and that the client is authenticated. Check browser console for errors.
- **Cron runs but no push:** Confirm `pushSent` in the cron response. If 0, either the user has no tokens stored or FCM failed (e.g. invalid/expired token). Ensure Firebase Admin is configured and Cloud Messaging API is enabled for the project.
