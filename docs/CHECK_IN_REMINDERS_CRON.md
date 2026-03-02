# Check-in reminder notifications (Perth time)

Clients are notified in-app when their check-in opens and when it is closing.

## Schedule (Perth, Australia/Perth)

| Time        | Trigger   | Notification |
|------------|-----------|--------------|
| **Friday 10am** | Check-in open  | "Check In is now Open" – weekly check-in for the week starting next Monday is now available. |
| **Monday 5pm**  | Check-in closing | "Your check-in is closing today at 5pm" – complete your check-in for this week before 5pm. |

Notifications are created in the `notifications` collection with `userId` = the client’s auth UID. Clients can see them under **Notifications** in the client app (and mark as read).

## Cron API

**Endpoint:** `POST /api/cron/check-in-reminders`

**Auth:** Request must include the shared secret:

- Header: `Authorization: Bearer <CRON_SECRET>`, or  
- Header: `x-cron-secret: <CRON_SECRET>`

**Body:**

```json
{ "type": "open" }
```

or

```json
{ "type": "closing" }
```

- **`open`** – Run on **Friday 10am Perth**. Finds assignments with `reflectionWeekStart` = next Monday (Perth) and status in `pending` / `active` / `overdue` / `started`; creates one notification per client (title: "Check In is now Open").
- **`closing`** – Run on **Monday 5pm Perth**. Finds assignments with `reflectionWeekStart` = this Monday (Perth) and status not completed; creates one notification per client.

**Response:** `{ "ok": true, "type": "open" | "closing", "weekStart": "YYYY-MM-DD", "sent": number }`

## Setting up the cron

1. **Environment:** Set `CRON_SECRET` to a long random string (e.g. in Vercel/Cloud Run env).

2. **Scheduler:** Call the endpoint at the right **Perth** times:
   - **Friday 9:00** Perth → e.g. cron `0 1 * * 5` UTC (Friday 01:00 UTC = 09:00 Perth in standard time; adjust for DST if needed – Perth does not use DST, so it’s always UTC+8).
   - **Monday 17:00** Perth → e.g. cron `0 9 * * 1` UTC (Monday 09:00 UTC = 17:00 Perth).

   Use a cron service (Vercel Cron, Google Cloud Scheduler, etc.) that sends a POST with body `{"type":"open"}` or `{"type":"closing"}` and the `Authorization: Bearer <CRON_SECRET>` header.

3. **Firestore:** Ensure the composite index for `check_in_assignments` on `(reflectionWeekStart, status)` is deployed (see `firestore.indexes.json`).

## Client notifications API

- **GET /api/client/notifications** – List notifications for the authenticated client (`userId` = auth UID).
- **PATCH /api/client/notifications/[id]** – Mark a notification as read.
