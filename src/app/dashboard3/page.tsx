"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy preview URL — redesign is now the default at /client. */
export default function Dashboard3RedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/client");
  }, [router]);
  return <p className="p-6 text-[var(--color-text-muted)]">Opening your dashboard…</p>;
}
