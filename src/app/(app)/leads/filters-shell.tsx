"use client";

import { useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** En mobile los filtros viven detrás de un botón; en desktop siempre visibles. */
export function FiltersShell({
  children,
  activeCount,
}: {
  children: React.ReactNode;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between border border-line bg-surface2 px-3 text-sm md:hidden"
      >
        <span className="flex items-center gap-2 text-muted">
          <SlidersHorizontal className="size-4" />
          Filtros
          {activeCount > 0 && (
            <span className="numeric rounded-[3px] bg-accent/15 px-1.5 text-[10px] font-bold text-accent">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown className={cn("size-4 text-dim transition-transform", open && "rotate-180")} />
      </button>
      <div
        className={cn(
          "grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6",
          open ? "mt-2 grid" : "hidden md:grid"
        )}
      >
        {children}
      </div>
    </div>
  );
}
