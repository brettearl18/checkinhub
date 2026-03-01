"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

export type Role = "client" | "coach" | "admin" | null;

export interface AuthIdentity {
  role: Role;
  clientId: string | null;
  coachId: string | null;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

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
    const token = await user.getIdToken(true);
    await loadIdentity(user.uid, token);
  }, [user, loadIdentity]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setAuthReady(true);
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setIdentity(null);
        setError(null);
        setAuthReady(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const token = await firebaseUser.getIdToken();
        await loadIdentity(firebaseUser.uid, token);
      } finally {
        setAuthReady(true);
        setLoading(false);
      }
    });
    return () => unsub();
  }, [loadIdentity]);

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
      return user.getIdToken(forceRefresh);
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
