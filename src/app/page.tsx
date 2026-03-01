"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { user, identity, authReady } = useAuth();

  useEffect(() => {
    if (!authReady) return;
    if (user && identity?.role === "client") {
      router.replace("/client");
      return;
    }
    if (user && identity?.role === "coach") {
      router.replace("/coach");
      return;
    }
  }, [authReady, user, identity?.role, router]);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-semibold text-[var(--color-text)]">
            CheckinHUB
          </h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Coach–client check-in and progress platform
          </p>
        </header>

        <Card className="p-6">
          <h2 className="text-lg font-medium text-[var(--color-text)]">
            Get started
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Sign in as client or coach to continue.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="primary">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/client">Client portal</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/coach">Coach dashboard</Link>
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
