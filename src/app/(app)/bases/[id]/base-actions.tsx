"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil, RefreshCw, Shuffle, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import {
  deleteSearch,
  distributeBase,
  rerunSearch,
  setSearchArchived,
  updateSearch,
} from "@/server/bases";
import type { DistributionMode } from "@/server/team";

interface SearchInfo {
  id: string;
  name: string;
  notes: string | null;
  productId: string | null;
  autoRerun: boolean;
  archived: boolean;
  isGmaps: boolean;
}

export function BaseActions({
  search,
  unassignedCount,
  teams,
  members,
  products,
  apify,
  isOwner,
}: {
  search: SearchInfo;
  unassignedCount: number;
  teams: { id: string; name: string }[];
  members: { id: string; name: string }[];
  products: { id: string; name: string }[];
  apify: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<DistributionMode>("round_robin");

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(null), 5000);
  }

  async function onEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    await updateSearch(search.id, {
      name: String(fd.get("name") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      productId: String(fd.get("product") ?? "") || null,
      autoRerun: fd.get("autoRerun") === "on",
    });
    setBusy(false);
    setEditOpen(false);
    router.refresh();
  }

  async function onDistribute() {
    if (!target) return;
    setBusy(true);
    const [kind, id] = target.split(":");
    const result = await distributeBase(
      search.id,
      kind === "team" ? { teamId: id } : { userId: id },
      mode
    );
    setBusy(false);
    flash(result.ok ? `✅ ${result.assigned} leads asignados.` : `⚠️ ${result.error}`);
    router.refresh();
  }

  async function onRerun() {
    setBusy(true);
    const result = await rerunSearch(search.id);
    setBusy(false);
    flash(result.ok ? "🔄 Búsqueda relanzada — solo van a entrar negocios nuevos." : `⚠️ ${result.error}`);
    router.refresh();
  }

  async function onDelete(deleteUncontacted: boolean) {
    setBusy(true);
    const result = await deleteSearch(search.id, deleteUncontacted);
    setBusy(false);
    if (result.ok) {
      router.push("/bases");
      router.refresh();
    } else {
      flash(`⚠️ ${result.error}`);
      setDeleteOpen(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Distribución dirigida de la base */}
        <Shuffle className="size-4 text-accent" />
        <Select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-auto min-w-44 flex-1 sm:flex-none"
          aria-label="Destino"
        >
          <option value="">Repartir a…</option>
          {teams.length > 0 && (
            <optgroup label="Equipos">
              {teams.map((t) => (
                <option key={t.id} value={`team:${t.id}`}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Vendedores">
            {members.map((m) => (
              <option key={m.id} value={`user:${m.id}`}>
                {m.name}
              </option>
            ))}
          </optgroup>
        </Select>
        <Select
          value={mode}
          onChange={(e) => setMode(e.target.value as DistributionMode)}
          className="w-auto"
          aria-label="Modo"
        >
          <option value="round_robin">Parejo</option>
          <option value="por_carga">Equilibrar carga</option>
          <option value="por_score">Mejores primero</option>
        </Select>
        <Button onClick={onDistribute} loading={busy} disabled={!target || unassignedCount === 0} size="sm">
          Repartir {unassignedCount > 0 ? unassignedCount : ""}
        </Button>

        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />

        {search.isGmaps && apify && (
          <Button variant="secondary" size="sm" onClick={onRerun} disabled={busy}>
            <RefreshCw className="size-3.5" /> Re-ejecutar
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="size-3.5" /> Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await setSearchArchived(search.id, !search.archived);
            router.refresh();
          }}
        >
          <Archive className="size-3.5" /> {search.archived ? "Desarchivar" : "Archivar"}
        </Button>
        {isOwner && (
          <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-danger">
            <Trash2 className="size-3.5" /> Borrar
          </Button>
        )}
      </div>
      {message && <p className="text-xs text-muted">{message}</p>}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar base">
        <form onSubmit={onEdit} className="space-y-4">
          <div>
            <Label htmlFor="b-name">Nombre</Label>
            <Input id="b-name" name="name" required defaultValue={search.name} />
          </div>
          <div>
            <Label htmlFor="b-product">Producto objetivo</Label>
            <Select id="b-product" name="product" defaultValue={search.productId ?? ""}>
              <option value="">Multi-producto (todos)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="b-notes">Notas</Label>
            <Textarea id="b-notes" name="notes" rows={3} defaultValue={search.notes ?? ""} />
          </div>
          {search.isGmaps && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="autoRerun"
                defaultChecked={search.autoRerun}
                className="size-4 accent-[var(--accent)]"
              />
              Re-ejecutar automáticamente cada semana (solo entran negocios nuevos)
            </label>
          )}
          <Button type="submit" loading={busy} className="w-full">
            Guardar
          </Button>
        </form>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Borrar base">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            ¿Qué hacemos con los leads de esta base? Los que ya fueron trabajados (contactados,
            con respuesta, clientes…) se conservan SIEMPRE.
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" loading={busy} onClick={() => onDelete(false)}>
              Borrar base, conservar todos los leads
            </Button>
            <Button variant="danger" loading={busy} onClick={() => onDelete(true)}>
              Borrar base + leads nunca trabajados
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
