"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Badges are coach-managed only — redirect clients to dashboard. */
export default function ClientAchievementsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/client");
  }, [router]);

  return null;
}
