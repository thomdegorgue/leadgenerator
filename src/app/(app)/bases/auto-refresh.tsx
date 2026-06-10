"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresca la página cada 6s mientras haya corridas en progreso. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}
