"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured.");
      return;
    }
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Check your email</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            If an account exists for <strong>{email}</strong>, we’ve sent a link to reset your password.
          </p>
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">
            Didn’t get it? Check spam or{" "}
            <button type="button" onClick={() => { setSent(false); setError(null); }} className="text-[var(--color-primary)] hover:underline">
              try again
            </button>
            .
          </p>
          <p className="mt-6">
            <Link href="/sign-in" className="text-sm text-[var(--color-primary)] hover:underline">
              Back to sign in
            </Link>
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Reset password</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Enter your email and we’ll send you a link to reset your password.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
          <Link href="/sign-in" className="text-[var(--color-primary)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
