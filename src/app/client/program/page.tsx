"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function ClientProgramPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[var(--color-text)]">Program</h1>
      <Card className="p-8 sm:p-12 text-center">
        <p className="text-2xl font-semibold text-[var(--color-text)]">Coming soon</p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
          We’re building your program experience. You’ll be able to view your workouts and follow your plan here soon.
        </p>
        <p className="mt-6">
          <Link
            href="/client"
            className="inline-block rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary)]/90"
          >
            Back to dashboard
          </Link>
        </p>
      </Card>
    </div>
  );
}
