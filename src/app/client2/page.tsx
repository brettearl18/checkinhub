"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy URL — new dashboard now lives at /client. */
export default function Client2RedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/client");
  }, [router]);
  return <p className="p-6 text-[var(--color-text-muted)]">Opening your dashboard…</p>;
}
