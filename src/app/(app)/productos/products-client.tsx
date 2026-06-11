"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { SIGNAL_OPTIONS } from "@/lib/status";
import { deleteProduct, recalcAllScores, upsertProduct } from "@/server/products";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductsClient({
  products,
  isOwner,
  leadCount,
}: {
  products: Product[];
  isOwner: boolean;
  leadCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [rules, setRules] = useState<Record<string, number>>({});
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recalcing, setRecalcing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function open(p: Product | "new") {
    setEditing(p);
    setRules(p === "new" ? { category_match: 30, uses_whatsapp: 20 } : { ...p.score_rules });
    setKeywords(p === "new" ? "" : (p.category_keywords ?? []).join(", "));
    setError(null);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const result = await upsertProduct({
      id: editing === "new" ? undefined : editing?.id,
      name: String(fd.get("name") ?? ""),
      description: String(fd.get("description") ?? ""),
      pitch: String(fd.get("pitch") ?? ""),
      priceFrom: String(fd.get("price") ?? ""),
      categoryKeywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      scoreRules: rules,
      active: fd.get("active") === "on",
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function onRecalc() {
    setRecalcing(true);
    setMessage(null);
    const result = await recalcAllScores();
    setRecalcing(false);
    setMessage(result.ok ? `Scores recalculados para ${result.count} leads.` : result.error);
    router.refresh();
  }

  const totalPoints = Object.values(rules).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {isOwner && (
          <Button onClick={() => open("new")}>
            <Plus className="size-4" /> Nuevo producto
          </Button>
        )}
        <Button variant="secondary" onClick={onRecalc} loading={recalcing}>
          <RefreshCw className="size-4" /> Recalcular scores ({leadCount} leads)
        </Button>
        {message && <p className="text-xs text-muted">{message}</p>}
      </div>

      {products.length === 0 ? (
        <EmptyState icon={Package} title="Sin productos" description="Dá de alta lo que vendés." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {products.map((p) => (
            <Card key={p.id} className={cn("space-y-2", !p.active && "opacity-50")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{p.name}</p>
                  {p.description && <p className="mt-0.5 text-xs text-muted">{p.description}</p>}
                </div>
                {isOwner && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => open(p)}
                      className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-fg"
                      title="Editar"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`¿Borrar "${p.name}"? Se borran también sus scores.`)) {
                          await deleteProduct(p.id);
                          router.refresh();
                        }
                      }}
                      className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-danger"
                      title="Borrar"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
              {(p.category_keywords ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.category_keywords.map((k) => (
                    <Badge key={k} className="border-accent/25 bg-accent/5 text-accent">
                      {k}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted">
                {Object.keys(p.score_rules ?? {}).length} señales de score
                {p.price_from && ` · desde ${p.price_from}`}
                {!p.active && " · inactivo"}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nuevo producto" : "Editar producto"}
      >
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <Label htmlFor="p-name">Nombre *</Label>
            <Input
              id="p-name"
              name="name"
              required
              defaultValue={editing !== "new" ? editing?.name : ""}
              placeholder="Agenda de Turnos"
            />
          </div>
          <div>
            <Label htmlFor="p-desc">Descripción (la usa la IA para calificar)</Label>
            <Textarea
              id="p-desc"
              name="description"
              rows={2}
              defaultValue={editing !== "new" ? editing?.description ?? "" : ""}
              placeholder="Reservas y turnos automáticos online para negocios de servicios"
            />
          </div>
          <div>
            <Label htmlFor="p-pitch">Pitch de venta (lo usa la IA para el speech)</Label>
            <Textarea
              id="p-pitch"
              name="pitch"
              rows={2}
              defaultValue={editing !== "new" ? editing?.pitch ?? "" : ""}
              placeholder="Dejá de coordinar turnos por WhatsApp: tus clientes reservan solos 24/7"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-price">Precio desde</Label>
              <Input
                id="p-price"
                name="price"
                defaultValue={editing !== "new" ? editing?.price_from ?? "" : ""}
                placeholder="$25.000/mes"
              />
            </div>
            <label className="flex items-end gap-2 pb-2.5 text-sm text-muted">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing === "new" ? true : editing?.active}
                className="size-4 accent-[var(--accent)]"
              />
              Activo
            </label>
          </div>
          <div>
            <Label htmlFor="p-keywords">Rubros ideales (keywords, separadas por coma)</Label>
            <Input
              id="p-keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="peluquería, barbería, estética, consultorio"
            />
            <p className="mt-1 text-[11px] text-muted">
              Activan la señal &quot;Rubro ideal&quot; cuando el rubro del lead las contiene.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <Label className="mb-0">Reglas de score</Label>
              <span className={cn("numeric text-xs", totalPoints > 100 ? "text-warn" : "text-muted")}>
                {totalPoints} pts {totalPoints > 100 && "(se recorta a 100)"}
              </span>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
              {SIGNAL_OPTIONS.map((signal) => {
                const active = signal.key in rules;
                return (
                  <div
                    key={signal.key}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5",
                      active ? "bg-accent/5" : "opacity-70"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) =>
                        setRules((r) => {
                          const next = { ...r };
                          if (e.target.checked) next[signal.key] = 20;
                          else delete next[signal.key];
                          return next;
                        })
                      }
                      className="size-4 shrink-0 accent-[var(--accent)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{signal.label}</p>
                      <p className="truncate text-[10px] text-muted">{signal.hint}</p>
                    </div>
                    {active && (
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={rules[signal.key]}
                        onChange={(e) =>
                          setRules((r) => ({ ...r, [signal.key]: parseInt(e.target.value, 10) || 0 }))
                        }
                        className="numeric h-8 w-16 rounded-md border border-line bg-surface px-2 text-right text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" loading={saving} className="w-full">
            Guardar producto
          </Button>
          <p className="text-center text-[11px] text-muted">
            Después de cambiar reglas, usá &quot;Recalcular scores&quot; para aplicarlas a toda la base.
          </p>
        </form>
      </Modal>
    </div>
  );
}
