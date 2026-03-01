"use client";

import { Button } from "@/components/ui/Button";

interface AuthErrorRetryProps {
  message?: string;
  onRetry: () => void;
}

export function AuthErrorRetry({
  message = "Please sign in again or refresh the page.",
  onRetry,
}: AuthErrorRetryProps) {
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--color-error)]/30 bg-[var(--color-bg-elevated)] p-6 text-center"
      role="alert"
    >
      <p className="text-sm font-medium text-[var(--color-error)]">{message}</p>
      <Button variant="secondary" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
