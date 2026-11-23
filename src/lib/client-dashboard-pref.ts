/** Client home preference: new dashboard is default; classic is opt-in via Profile. */

export type ClientDashboardPref = "new" | "classic";

export const CLIENT_DASHBOARD_PREF_KEY = "checkinhub.clientDashboard";

export function getClientDashboardPref(): ClientDashboardPref {
  if (typeof window === "undefined") return "new";
  try {
    const raw = window.localStorage.getItem(CLIENT_DASHBOARD_PREF_KEY);
    return raw === "classic" ? "classic" : "new";
  } catch {
    return "new";
  }
}

export function setClientDashboardPref(pref: ClientDashboardPref): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLIENT_DASHBOARD_PREF_KEY, pref);
  } catch {
    // ignore quota / private mode
  }
}
