"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

function ClientOnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [loading, setLoading] = useState(!!token && !!email);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!token || !email) {
      setLoading(false);
      setError("Invalid link. Your invite link should include token and email.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/client-onboarding/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, email }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError((data as { error?: string }).error ?? "Invalid or expired link.");
          return;
        }
        const name = (data as { displayName?: string }).displayName ?? (data as { firstName?: string }).firstName ?? "there";
        setClientName(name);
      } catch {
        if (!cancelled) setError("Could not verify your invite link.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/client-onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Something went wrong.");
        return;
      }
      setComplete(true);
      setTimeout(() => router.push("/sign-in"), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md p-6">
          <p className="text-[var(--color-text-muted)]">Verifying your invite link…</p>
        </Card>
      </main>
    );
  }

  if (error && !clientName) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Invalid or expired link</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{error}</p>
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">
            Ask your coach to send you a new invite link, or try signing in if you already have an account.
          </p>
          <Button asChild variant="primary" className="mt-6">
            <Link href="/sign-in">Go to sign in</Link>
          </Button>
        </Card>
      </main>
    );
  }

  if (complete) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">You’re all set</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Your password has been set. Redirecting you to sign in…
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Set your password</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Hi{clientName ? ` ${clientName}` : ""}. Choose a password to finish setting up your account.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            disabled
            className="bg-[var(--color-bg-elevated)] opacity-80"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Same as above"
            autoComplete="new-password"
          />
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? "Setting password…" : "Set password & continue"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
          <Link href="/sign-in" className="text-[var(--color-primary)] hover:underline">
            Already have an account? Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}

export default function ClientOnboardingPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md p-6">
          <p className="text-[var(--color-text-muted)]">Loading…</p>
        </Card>
      </main>
    }>
      <ClientOnboardingForm />
    </Suspense>
  );
}
