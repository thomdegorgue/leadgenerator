"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, CornerDownLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { navFor } from "@/components/shell/nav";
import { STATUS } from "@/lib/status";
import type { LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Result {
  kind: "nav" | "lead";
  label: string;
  sublabel?: string;
  href: string;
}

export function CommandPalette({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setLeads([]);
        setActive(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!q.trim()) {
        setLeads([]);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("leads")
        .select("id, name, city, status")
        .ilike("name", `%${q.trim()}%`)
        .limit(6);
      setLeads(
        (data ?? []).map((l) => ({
          kind: "lead" as const,
          label: l.name,
          sublabel: [l.city, STATUS[l.status as LeadStatus]?.label].filter(Boolean).join(" · "),
          href: `/leads/${l.id}`,
        }))
      );
    }, 200);
  }, []);

  const navResults: Result[] = navFor(isAdmin)
    .filter((i) => !query.trim() || i.label.toLowerCase().includes(query.trim().toLowerCase()))
    .map((i) => ({ kind: "nav", label: i.label, href: i.href }));

  const results = [...leads, ...navResults].slice(0, 10);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[18vh]"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-lg overflow-hidden rounded-xl"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                  search(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  }
                  if (e.key === "Enter" && results[active]) go(results[active].href);
                }}
                placeholder="Buscar leads o ir a…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
              />
              <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">Sin resultados</p>
              ) : (
                results.map((r, i) => (
                  <button
                    key={`${r.kind}-${r.href}`}
                    onClick={() => go(r.href)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm",
                      i === active ? "bg-accent/10 text-accent" : "text-fg"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {r.label}
                      {r.sublabel && <span className="ml-2 text-xs text-muted">{r.sublabel}</span>}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted">
                      {r.kind === "lead" ? "lead" : "ir a"}
                    </span>
                    {i === active && <CornerDownLeft className="size-3.5 text-muted" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
