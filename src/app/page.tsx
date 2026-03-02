"use client";

import Image from "next/image";
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
    <main className="min-h-screen flex flex-col">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[var(--color-bg)] via-[var(--color-bg)] to-[var(--color-primary-subtle)] pointer-events-none" aria-hidden />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--color-primary-subtle),transparent)] pointer-events-none" aria-hidden />

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-16">
        <header className="text-center mb-10 sm:mb-12">
          <Image
            src="/Vana Logo-1-Black-RGB.png"
            alt="Vana"
            width={160}
            height={64}
            className="mx-auto mb-6 object-contain"
            priority
          />
          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--color-text)] tracking-tight">
            CheckinHUB
          </h1>
          <p className="mt-3 text-base sm:text-lg text-[var(--color-text-secondary)] max-w-sm mx-auto">
            Coach–client check-in and progress platform
          </p>
        </header>

        <Card className="w-full max-w-md p-8 sm:p-10 shadow-lg border-[var(--color-border)] bg-[var(--color-bg-elevated)]/95 backdrop-blur-sm">
          <div className="w-10 h-1 rounded-full bg-[var(--color-primary)] mb-6" aria-hidden />
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            Get started
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Sign in or open your portal to continue.
          </p>
          <div className="mt-8 space-y-3">
            <Button asChild variant="primary" className="w-full justify-center py-3 text-base font-medium">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button asChild variant="secondary" className="w-full justify-center">
                <Link href="/client">Client portal</Link>
              </Button>
              <Button asChild variant="secondary" className="w-full justify-center">
                <Link href="/coach">Coach dashboard</Link>
              </Button>
            </div>
          </div>
        </Card>

        <footer className="mt-12 text-center">
          <Link
            href="/privacy"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            Privacy
          </Link>
        </footer>
      </div>
    </main>
  );
}
