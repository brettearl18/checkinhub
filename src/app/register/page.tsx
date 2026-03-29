"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/client-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          inviteCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Could not register.");
        return;
      }

      if (isFirebaseConfigured()) {
        const auth = getFirebaseAuth();
        await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        router.push("/client");
        return;
      }

      router.push("/sign-in");
    } catch {
      setError("Could not register. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Register Here</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          New clients: enter your details and use your registration code.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <Input
            label="Registration code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
            placeholder="Enter your code"
          />

          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "Registering…" : "Register"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
          Already registered?{" "}
          <Link href="/sign-in" className="text-[var(--color-primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
