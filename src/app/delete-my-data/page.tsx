"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

type Step = "verify" | "sign-in" | "confirm" | "done";

function DeleteMyDataForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const emailParam = searchParams.get("email") ?? "";
  const { user, identity, authReady, loading: authLoading, getToken } = useAuth();

  const [step, setStep] = useState<Step>("verify");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifiedClientId, setVerifiedClientId] = useState<string | null>(null);

  const verifyLink = useCallback(async () => {
    if (!token || !emailParam) {
      setError("Invalid link. Use the delete link from your email.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client/delete-data/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email: emailParam }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Invalid or expired link.");
        return;
      }
      setFirstName(typeof data.firstName === "string" ? data.firstName : "");
      setEmail(typeof data.email === "string" ? data.email : emailParam);
      setVerifiedClientId(typeof data.clientId === "string" ? data.clientId : null);
      setStep("sign-in");
    } catch {
      setError("Could not verify your link.");
    } finally {
      setLoading(false);
    }
  }, [token, emailParam]);

  useEffect(() => {
    verifyLink();
  }, [verifyLink]);

  useEffect(() => {
    if (!authReady || loading || step !== "sign-in") return;
    if (user && identity?.clientId && verifiedClientId && identity.clientId === verifiedClientId) {
      setStep("confirm");
      setError(null);
    }
  }, [authReady, authLoading, user, identity, verifiedClientId, loading, step]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isFirebaseConfigured()) {
      setError("Sign-in is not configured.");
      return;
    }
    setSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      setStep("confirm");
    } catch {
      setError("Sign in failed. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!lastName.trim()) {
      setError("Please enter your last name.");
      return;
    }
    setSubmitting(true);
    try {
      const authToken = await getToken(true);
      if (!authToken) {
        setError("Please sign in again.");
        setStep("sign-in");
        return;
      }
      const res = await fetch("/api/client/delete-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token, email, lastName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not delete your data.");
        return;
      }
      if (isFirebaseConfigured()) {
        try {
          await signOut(getFirebaseAuth());
        } catch {
          // non-fatal
        }
      }
      setStep("done");
    } catch {
      setError("Could not delete your data.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || (step === "verify" && !error)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md p-6">
          <p className="text-[var(--color-text-muted)]">Verifying your link…</p>
        </Card>
      </main>
    );
  }

  if (error && step === "verify") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md p-6 space-y-4">
          <p className="text-[var(--color-error)]">{error}</p>
          <Link href="/sign-in" className="text-sm text-[var(--color-primary)] hover:underline">
            Go to sign in
          </Link>
        </Card>
      </main>
    );
  }

  if (step === "done") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md p-6 space-y-4 text-center">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Your data has been deleted</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Your CheckinHUB account and stored progress have been permanently removed.
          </p>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/">Return to home</Link>
          </Button>
        </Card>
      </main>
    );
  }

  const greeting = firstName.trim() || "there";

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Delete my data</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Hi {greeting} — this permanently deletes your account data. This cannot be undone.
        </p>

        {step === "sign-in" && (
          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <Input label="Email" type="email" value={email} readOnly />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in to continue"}
            </Button>
          </form>
        )}

        {step === "confirm" && (
          <form onSubmit={handleDelete} className="mt-6 space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Signed in as <strong className="text-[var(--color-text)]">{email}</strong>. Enter your
              last name to confirm permanent deletion.
            </p>
            <Input
              label="Last name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
            />
            {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
              {submitting ? "Deleting…" : "Permanently delete my data"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={submitting}
              onClick={() => {
                setError(null);
                setStep("sign-in");
              }}
            >
              Cancel
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}

export default function DeleteMyDataPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-8">
          <Card className="w-full max-w-md p-6">
            <p className="text-[var(--color-text-muted)]">Loading…</p>
          </Card>
        </main>
      }
    >
      <DeleteMyDataForm />
    </Suspense>
  );
}
