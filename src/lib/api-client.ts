"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useApiClient() {
  const { getToken } = useAuth();

  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}, retried = false): Promise<Response> => {
      try {
        const token = await getToken(retried);
        const res = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: token ? `Bearer ${token}` : "",
          },
        });
        if (res.status === 401 && !retried) {
          const tokenRefresh = await getToken(true);
          return fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              Authorization: tokenRefresh ? `Bearer ${tokenRefresh}` : "",
            },
          });
        }
        return res;
      } catch (err) {
        if (err instanceof TypeError && err.message === "Failed to fetch") {
          throw new Error(
            "Network error. Check your connection and that the app is running (e.g. npm run dev)."
          );
        }
        throw err;
      }
    },
    [getToken]
  );
  // Wrapper so retried is always false on first call
  const fetchWithAuthStable = useCallback(
    (url: string, options?: RequestInit) => fetchWithAuth(url, options, false),
    [fetchWithAuth]
  );

  return { fetchWithAuth: fetchWithAuthStable };
}
