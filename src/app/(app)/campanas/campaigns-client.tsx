"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Shuffle, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select } from "@/components/ui/field";
import {
  createCampaign,
  deleteCampaign,
  distributeCampaign,
  setCampaignStatus,
} from "@/server/campaigns";
import type { Team } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface CampaignCard {
  id: string;
  name: string;
  status: string;
  productName: string | null;
  teamName: string | null;
  teamId: string | null;
  total: number;
  sinAsignar: number;
  contactados: number;
  respondieron: number;
  clientes: number;
}

export function CampaignsClient({
  campaigns,
  teams,
  products,
}: {
  campaigns: CampaignCard[];
  teams: Team[];
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await createCampaign({
      name: String(fd.get("name") ?? ""),
      productId: String(fd.get("product") ?? "") || null,
      minScore: parseInt(String(fd.get("min") ?? "0"), 10) || 0,
      city: String(fd.get("city") ?? ""),
      teamId: String(fd.get("team") ?? "") || null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setMessage(`✅ Campaña creada con ${result.added} leads.`);
    router.refresh();
  }

  async function onDistribute(id: string) {
    setBusyId(id);
    const result = await distributeCampaign(id);
    setBusyId(null);
    setMessage(result.ok ? `✅ ${result.assigned} leads repartidos al equipo.` : `⚠️ ${result.error}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Nueva campaña
        </Button>
        {message && <p className="text-xs text-muted">{message}</p>}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {campaigns.map((c) => {
          const tasa = c.contactados > 0 ? Math.round((c.respondieron / c.contactados) * 100) : 0;
          return (
            <Card key={c.id} className={cn("space-y-3", c.status !== "activa" && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Megaphone className="size-4 shrink-0 text-accent" />
                    <p className="truncate font-medium">{c.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {[c.productName && `🎯 ${c.productName}`, c.teamName && `👥 ${c.teamName}`]
                      .filter(Boolean)
                      .join(" · ") || "Sin producto ni equipo"}
                  </p>
                </div>
                <Badge
                  className={
                    c.status === "activa"
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                      : "border-line text-muted"
                  }
                >
                  {c.status}
                </Badge>
              </div>

              <div className="numeric grid grid-cols-4 gap-2 text-center text-sm">
                <div>
                  <p className="text-lg font-semibold">{c.total}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">Leads</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{c.contactados}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">Contact.</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-violet-300">{tasa}%</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">Respuesta</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-success">{c.clientes}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">Clientes</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/leads?campania=${c.id}`} className="text-xs text-accent hover:underline">
                  Ver leads →
                </Link>
                <span className="flex-1" />
                {c.teamId && c.sinAsignar > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busyId === c.id}
                    onClick={() => onDistribute(c.id)}
                  >
                    <Shuffle className="size-3.5" /> Repartir {c.sinAsignar}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await setCampaignStatus(c.id, c.status === "activa" ? "pausada" : "activa");
                    router.refresh();
                  }}
                >
                  {c.status === "activa" ? "Pausar" : "Activar"}
                </Button>
                <button
                  onClick={async () => {
                    if (confirm(`¿Borrar la campaña "${c.name}"? Los leads no se tocan.`)) {
                      await deleteCampaign(c.id);
                      router.refresh();
                    }
                  }}
                  className="rounded-lg p-1.5 text-muted hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva campaña">
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <Label htmlFor="c-name">Nombre *</Label>
            <Input id="c-name" name="name" required placeholder="Catálogos — Distribuidoras Rosario" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c-product">Producto</Label>
              <Select id="c-product" name="product" defaultValue="">
                <option value="">Cualquiera</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="c-min">Score mínimo</Label>
              <Select id="c-min" name="min" defaultValue="60">
                {[0, 40, 50, 60, 70, 80].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "Sin mínimo" : `≥ ${n}`}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c-city">Ciudad (opcional)</Label>
              <Input id="c-city" name="city" placeholder="Rosario" />
            </div>
            <div>
              <Label htmlFor="c-team">Equipo (opcional)</Label>
              <Select id="c-team" name="team" defaultValue="">
                <option value="">Sin equipo</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted">
            La campaña se carga con los leads activos que matchean el filtro. El score mínimo
            aplica sobre el producto elegido.
          </p>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" loading={saving} className="w-full">
            Crear campaña
          </Button>
        </form>
      </Modal>
    </div>
  );
}
