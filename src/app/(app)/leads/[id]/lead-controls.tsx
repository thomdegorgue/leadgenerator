"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trophy, CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Label, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { DISCARD_REASONS, STATUS, STATUS_ORDER } from "@/lib/status";
import { assignLead, discardLead, registerDeal, scheduleFollowup, updateLeadStatus } from "@/server/leads";
import type { LeadStatus } from "@/lib/types";

export function LeadControls({
  leadId,
  status,
  assignedTo,
  isAdmin,
  members,
  products,
  hasDeal,
}: {
  leadId: string;
  status: LeadStatus;
  assignedTo: string | null;
  isAdmin: boolean;
  members: { userId: string; name: string }[];
  products: { id: string; name: string }[];
  hasDeal: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [discardReason, setDiscardReason] = useState("");
  const [dealOpen, setDealOpen] = useState(false);
  const [dealSaving, setDealSaving] = useState(false);

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  async function onDeal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDealSaving(true);
    const fd = new FormData(e.currentTarget);
    const value = parseFloat(String(fd.get("value") ?? ""));
    await registerDeal(
      leadId,
      String(fd.get("product") ?? "") || null,
      Number.isFinite(value) ? value : null
    );
    setDealSaving(false);
    setDealOpen(false);
    router.refresh();
  }

  return (
    <Card className="space-y-4">
      <div>
        <Label htmlFor="status">Estado</Label>
        <Select
          id="status"
          value={status}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as LeadStatus;
            if (next === "cliente") setDealOpen(true);
            else run(() => updateLeadStatus(leadId, next));
          }}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </Select>
      </div>

      {isAdmin && (
        <div>
          <Label htmlFor="assignee">Asignado a</Label>
          <Select
            id="assignee"
            value={assignedTo ?? ""}
            disabled={pending}
            onChange={(e) => run(() => assignLead(leadId, e.target.value || null))}
          >
            <option value="">Sin asignar</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <Label>Seguimiento</Label>
        <div className="flex gap-2">
          {[1, 3, 7].map((days) => (
            <Button
              key={days}
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => scheduleFollowup(leadId, days))}
              className="flex-1"
            >
              <CalendarClock className="size-3.5" /> +{days}d
            </Button>
          ))}
        </div>
      </div>

      {status === "cliente" && !hasDeal && (
        <Button variant="secondary" size="sm" onClick={() => setDealOpen(true)} className="w-full border-success/40 text-success">
          <Trophy className="size-4" /> Registrar venta
        </Button>
      )}

      {status !== "descartado" && (
        <div>
          <Label htmlFor="discard">Descartar por…</Label>
          <Select
            id="discard"
            value={discardReason}
            disabled={pending}
            onChange={(e) => {
              setDiscardReason(e.target.value);
              if (e.target.value) run(() => discardLead(leadId, e.target.value));
            }}
          >
            <option value="">Elegir motivo</option>
            {Object.entries(DISCARD_REASONS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <Link
        href={`/leads/${leadId}/editar`}
        className="flex items-center justify-center gap-2 rounded-lg border border-line py-2 text-sm text-muted hover:border-accent/40 hover:text-fg"
      >
        <Pencil className="size-3.5" /> Editar datos
      </Link>

      <Modal open={dealOpen} onClose={() => setDealOpen(false)} title="🏆 Registrar venta">
        <form onSubmit={onDeal} className="space-y-4">
          <div>
            <Label htmlFor="deal-product">Producto vendido</Label>
            <Select id="deal-product" name="product" defaultValue={products[0]?.id ?? ""}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="deal-value">Valor mensual (ARS)</Label>
            <Input id="deal-value" name="value" type="number" min={0} step="any" placeholder="45000" />
          </div>
          <Button type="submit" loading={dealSaving} className="w-full">
            Marcar como cliente 🎉
          </Button>
        </form>
      </Modal>
    </Card>
  );
}
