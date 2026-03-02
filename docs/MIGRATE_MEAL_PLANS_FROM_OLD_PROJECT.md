# Migrating meal plans from the old project

If the **old project** (e.g. previous CheckinHUB or CheckinV5 app) already had meal plans assigned to clients, you can load those into the current app in two ways.

---

## 1. Same Firebase project (e.g. CheckinV5)

If the current CheckinHUB app uses the **same** Firestore as the old project, client documents may already have the legacy fields:

- `mealPlanName` (string)
- `mealPlanUrl` (string)

The app **already shows** these in the UI: coach client settings and the client dashboard both treat legacy `mealPlanName` + `mealPlanUrl` as a single meal plan link when `mealPlanLinks` is empty. No migration step is required for display.

### Optional: backfill `mealPlanLinks` (new shape)

To store the data in the new shape (`mealPlanLinks` array) so it’s consistent and you can eventually drop legacy fields:

1. Set **CRON_SECRET** in your environment (e.g. Vercel) if not already set.
2. Call the migration endpoint once (e.g. from your machine or a script):

   ```bash
   curl -X POST "https://checkinhub-alpha.vercel.app/api/admin/migrate-meal-plans-from-legacy" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

3. Response example: `{ "ok": true, "totalClients": 50, "updated": 12 }` — `updated` is how many clients had legacy meal plan data written into `mealPlanLinks`.

After this, coach settings and client dashboard continue to work; the data is just stored in the new format.

---

## 2. Different Firebase project (export from old, then load)

If meal plan data lives in a **different** Firebase project:

1. **Export from the old project**  
   From the old Firestore, export the `clients` collection (or the subset with meal plan data). You need at least:
   - A way to match clients in the new app (e.g. **email**), and
   - `mealPlanName` and `mealPlanUrl` (or equivalent).

   You can:
   - Use Firebase Console → Firestore → select `clients` and export (e.g. to JSON/CSV via a script), or
   - Run a one-off script in the old project that reads `clients` and outputs rows like:  
     `email, mealPlanName, mealPlanUrl`.

2. **Load into the current app**  
   - **Manual:** For each client, open Coach → Clients → [client] → Settings → Meal plan, and assign the plan (from the dropdown or “add custom link”) then Save.
   - **Bulk:** If you have many clients, you can build a one-off script that:
     - Reads your export (e.g. CSV/JSON).
     - For each row, finds the client in the **current** Firestore by `email` (and optionally `coachId` if you have multiple coaches).
     - Updates that client doc with `mealPlanLinks: [{ label: mealPlanName, url: mealPlanUrl }]` (and `updatedAt`). Use the Firebase Admin SDK and the same `clients` collection the app uses.

The current app expects per-client meal plan data in either:

- **New shape:** `mealPlanLinks: [{ label: string, url: string }, ...]`
- **Legacy shape:** `mealPlanName` + `mealPlanUrl` (both non-empty). The UI shows these as one link; the migration route can copy them into `mealPlanLinks`.

---

## Summary

| Scenario | What to do |
|----------|------------|
| Same Firebase; legacy fields already on clients | Nothing required — app shows them. Optionally run `POST /api/admin/migrate-meal-plans-from-legacy` to backfill `mealPlanLinks`. |
| Different Firebase | Export clients (email + meal plan name/URL) from old project, then assign in the new app manually or via a script that updates current Firestore `clients` with `mealPlanLinks`. |
