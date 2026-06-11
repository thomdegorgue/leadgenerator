"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { DISCARD_REASONS, STATUS, STATUS_ORDER } from "@/lib/status";
import { assignLead, bulkLeads, type BulkAction } from "@/server/leads";
import { cn, initials } from "@/lib/utils";
import type { LeadStatus } from "@/lib/types";

export interface LeadRow {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  phone: string | null;
  status: LeadStatus;
  assignedTo: string | null;
  assigneeName: string | null;
  topScore: { score: number; product: string } | null;
}

function ScoreBadge({ top }: { top: LeadRow["topScore"] }) {
  if (!top) return <span className="text-xs text-muted">—</span>;
  const color =
    top.score >= 75 ? "text-success border-success/30 bg-success/10" :
    top.score >= 45 ? "text-warn border-warn/30 bg-warn/10" :
    "text-muted border-line bg-surface2";
  return (
    <span
      className={cn("numeric inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", color)}
      title={top.product}
    >
      {top.score}
      <span className="max-w-20 truncate font-sans font-normal text-[10px] opacity-80">{top.product}</span>
    </span>
  );
}

export function LeadsTable({
  rows,
  isAdmin,
  members,
  teams,
  campaigns,
}: {
  rows: LeadRow[];
  isAdmin: boolean;
  members: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function runBulk(action: BulkAction) {
    startTransition(async () => {
      const result = await bulkLeads([...selected], action);
      setMessage(result.ok ? `✓ ${result.affected} leads actualizados` : `⚠ ${result.error}`);
      setSelected(new Set());
      router.refresh();
      setTimeout(() => setMessage(null), 4000);
    });
  }

  function inlineAssign(leadId: string, userId: string) {
    startTransition(async () => {
      await assignLead(leadId, userId || null);
      router.refresh();
    });
  }

  const miniSelect =
    "h-8 rounded-md border border-line bg-surface px-2 text-xs focus:border-accent/60 focus:outline-none";

  return (
    <>
      {message && <p className="text-xs text-muted">{message}</p>}

      {/* Mobile: filas densas */}
      <div className="border border-line bg-surface md:hidden">
        {rows.map((lead, i) => (
          <div
            key={lead.id}
            className={cn("flex items-center gap-3 px-3 py-3", i > 0 && "border-t border-line")}
          >
            {isAdmin && (
              <input
                type="checkbox"
                checked={selected.has(lead.id)}
                onChange={() => toggle(lead.id)}
                className="size-4 shrink-0 accent-[var(--accent)]"
              />
            )}
            <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{lead.name}</p>
              <p className="truncate text-[11px] text-dim">
                {[lead.category, lead.city].filter(Boolean).join(" · ") || "—"}
              </p>
            </Link>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <ScoreBadge top={lead.topScore} />
              <StatusBadge status={lead.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden overflow-hidden border border-line md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>
              {isAdmin && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-4 accent-[var(--accent)]"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Ciudad</th>
              <th className="px-4 py-3 font-medium">Oportunidad</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Asignado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((lead) => (
              <tr key={lead.id} className="bg-surface/50 transition-colors hover:bg-surface2/60">
                {isAdmin && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggle(lead.id)}
                      className="size-4 accent-[var(--accent)]"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="font-medium hover:text-accent">
                    {lead.name}
                  </Link>
                  {lead.category && <p className="text-xs text-muted">{lead.category}</p>}
                </td>
                <td className="px-4 py-3 text-muted">{lead.city ?? "—"}</td>
                <td className="px-4 py-3">
                  <ScoreBadge top={lead.topScore} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <select
                      value={lead.assignedTo ?? ""}
                      onChange={(e) => inlineAssign(lead.id, e.target.value)}
                      disabled={pending}
                      className={miniSelect}
                    >
                      <option value="">Sin asignar</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : lead.assigneeName ? (
                    <span
                      className="flex size-7 items-center justify-center rounded-full bg-surface2 text-[10px] font-semibold text-accent"
                      title={lead.assigneeName}
                    >
                      {initials(lead.assigneeName)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Barra de acciones masivas */}
      <AnimatePresence>
        {isAdmin && selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="glass hud-ticks fixed inset-x-3 bottom-24 z-40 flex flex-wrap items-center gap-2 rounded-[6px] p-3 md:bottom-6 md:left-52 md:right-6"
          >
            <span className="numeric rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
              {selected.size}
            </span>
            <select
              className={miniSelect}
              disabled={pending}
              value=""
              onChange={(e) => e.target.value && runBulk({ type: "assign_user", userId: e.target.value })}
            >
              <option value="">Asignar a…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {teams.length > 0 && (
              <select
                className={miniSelect}
                disabled={pending}
                value=""
                onChange={(e) => e.target.value && runBulk({ type: "assign_team", teamId: e.target.value })}
              >
                <option value="">Repartir a equipo…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <select
              className={miniSelect}
              disabled={pending}
              value=""
              onChange={(e) =>
                e.target.value && runBulk({ type: "status", status: e.target.value as LeadStatus })
              }
            >
              <option value="">Estado…</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
            {campaigns.length > 0 && (
              <select
                className={miniSelect}
                disabled={pending}
                value=""
                onChange={(e) => e.target.value && runBulk({ type: "campaign", campaignId: e.target.value })}
              >
                <option value="">A campaña…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <select
              className={miniSelect}
              disabled={pending}
              value=""
              onChange={(e) => e.target.value && runBulk({ type: "discard", reason: e.target.value })}
            >
              <option value="">Descartar por…</option>
              {Object.entries(DISCARD_REASONS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto rounded-lg p-1.5 text-muted hover:text-fg"
              title="Limpiar selección"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
