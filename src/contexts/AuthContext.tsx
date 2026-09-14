"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { getFirebaseAuthErrorMessage, isFirebaseAuthError } from "@/lib/firebase-auth-errors";

export type Role = "client" | "coach" | "admin" | null;

export interface AuthIdentity {
  role: Role;
  clientId: string | null;
  coachId: string | null;
  firstName?: string;
  lastName?: string;
  coachCode?: string;
}

export interface AuthState {
  user: User | null;
  identity: AuthIdentity | null;
  loading: boolean;
  error: string | null;
  authReady: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  refetchIdentity: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Refresh ID token before the usual 1-hour expiry while the tab is open. */
const TOKEN_KEEPALIVE_MS = 45 * 60 * 1000;

async function fetchIdentity(token: string): Promise<AuthIdentity> {
  const res = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    throw new Error(await res.text().catch(() => "Failed to load identity"));
  }
  return res.json();
}

async function getIdTokenWithRetry(user: User, forceRefresh = false): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await user.getIdToken(forceRefresh || attempt > 0);
    } catch (err) {
      lastErr = err;
      // Brief backoff for flaky mobile networks / Token Service blips
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const userRef = useRef<User | null>(null);

  const loadIdentity = useCallback(async (uid: string, token: string) => {
    try {
      setError(null);
      const data = await fetchIdentity(token);
      setIdentity(data);
    } catch (e) {
      setIdentity(null);
      setError(e instanceof Error ? e.message : "Failed to load identity");
    }
  }, []);

  const refetchIdentity = useCallback(async () => {
    if (!user) return;
    const token = await getIdTokenWithRetry(user, true);
    await loadIdentity(user.uid, token);
  }, [user, loadIdentity]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setAuthReady(true);
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    let cancelled = false;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;
      setUser(firebaseUser);
      userRef.current = firebaseUser;
      if (!firebaseUser) {
        setIdentity(null);
        setError(null);
        setAuthReady(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const token = await getIdTokenWithRetry(firebaseUser);
        if (cancelled) return;
        await loadIdentity(firebaseUser.uid, token);
      } catch (e) {
        if (cancelled) return;
        // Keep the Firebase user; identity may retry via refetch. Avoid treating
        // a transient token blip as a full sign-out.
        setError(e instanceof Error ? e.message : "Failed to restore session");
      } finally {
        if (!cancelled) {
          setAuthReady(true);
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [loadIdentity]);

  // Keep session warm: refresh token when tab becomes visible and on an interval.
  useEffect(() => {
    if (!user) return;

    const refreshQuietly = () => {
      const current = userRef.current;
      if (!current) return;
      void current.getIdToken(true).catch(() => {
        /* network blip — next API call will retry */
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshQuietly();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refreshQuietly);
    const interval = window.setInterval(refreshQuietly, TOKEN_KEEPALIVE_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refreshQuietly);
      window.clearInterval(interval);
    };
  }, [user]);

  const signOut = useCallback(async () => {
    if (!isFirebaseConfigured()) return;
    const auth = getFirebaseAuth();
    await auth.signOut();
    setUser(null);
    setIdentity(null);
    setError(null);
  }, []);

  const getToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      if (!user) return null;
      try {
        return await getIdTokenWithRetry(user, forceRefresh);
      } catch (err) {
        if (isFirebaseAuthError(err)) {
          throw new Error(getFirebaseAuthErrorMessage(err));
        }
        throw err;
      }
    },
    [user]
  );

  const value: AuthContextValue = {
    user,
    identity,
    loading,
    error,
    authReady,
    signOut,
    getToken,
    refetchIdentity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
