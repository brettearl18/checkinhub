# Check-in reminder notifications (Perth time)

Clients are notified in-app when their check-in opens and when it is closing.

## Schedule (Perth, Australia/Perth)

| Time        | Trigger   | Notification |
|------------|-----------|--------------|
| **Friday 10am** | Check-in open  | "Check In is now Open" – weekly check-in for the week starting next Monday is now available. |
| **Monday 5pm**  | Check-in closing | "Your check-in is closing today at 5pm" – complete your check-in for this week before 5pm. |

Notifications are created in the `notifications` collection with `userId` = the client’s auth UID. Clients can see them under **Notifications** in the client app (and mark as read).

## Cron API

**Endpoints:**

- **GET** `/api/cron/check-in-reminders/open` – Check-in open (Friday 10am Perth). Used by Vercel Cron.
- **GET** `/api/cron/check-in-reminders/closing` – Closing reminder (Monday 5pm Perth). Used by Vercel Cron.
- **GET** `/api/cron/check-in-reminders?type=open|closing` – Same logic, type in query (manual/custom cron).
- **POST** `/api/cron/check-in-reminders` – Body `{ "type": "open" }` or `{ "type": "closing" }` (manual/custom cron).

**Auth:** Request must include the shared secret:

- Header: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sets this automatically when `CRON_SECRET` is set in env), or  
- Header: `x-cron-secret: <CRON_SECRET>`

- **`open`** – Run on **Friday 10am Perth**. Finds assignments with `reflectionWeekStart` = next Monday (Perth) and status in `pending` / `active` / `overdue` / `started`; creates one in-app notification, sends push (if enabled), and **sends email** per client (title: "Check In is now Open").
- **`closing`** – Run on **Monday 5pm Perth**. Same week logic for this Monday; creates in-app notification, push, and **email** per client (closing reminder).

**Response:** `{ "ok": true, "type": "open" | "closing", "weekStart": "YYYY-MM-DD", "sent": number, "pushSent": number, "emailSent": number }` (or `{ "ok": true, "sent": 0, "message": "..." }` when DB not configured).

## Setting up the cron (Vercel)

1. **Environment:** In Vercel project settings, set `CRON_SECRET` to a long random string. Vercel Cron will send it as `Authorization: Bearer <CRON_SECRET>` on each request.

2. **Schedule:** Defined in `vercel.json`:
   - **Friday 10:00 Perth** → `0 2 * * 5` (02:00 UTC) → `/api/cron/check-in-reminders/open`
   - **Monday 17:00 Perth** → `0 9 * * 1` (09:00 UTC) → `/api/cron/check-in-reminders/closing`

   After deploy, Vercel will trigger these GET requests automatically. No external scheduler needed.

3. **Firestore:** Ensure the composite index for `check_in_assignments` on `(reflectionWeekStart, status)` is deployed (see `firestore.indexes.json`).

## Client notifications API

- **GET /api/client/notifications** – List notifications for the authenticated client (`userId` = auth UID).
- **PATCH /api/client/notifications/[id]** – Mark a notification as read.
