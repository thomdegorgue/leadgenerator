"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { TEMPLATE_STAGES, TEMPLATE_VARIABLES, renderTemplate } from "@/lib/whatsapp";
import { deleteTemplate, toggleTemplate, upsertTemplate } from "@/server/templates";
import type { MessageTemplate, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

const SAMPLE = { nombre: "Distribuidora ABC", ciudad: "CABA", categoria: "distribuidora", vendedor: "Pedro" };

export function TemplatesClient({
  templates,
  products,
  canEdit,
}: {
  templates: MessageTemplate[];
  products: Product[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<MessageTemplate | "new" | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(t: MessageTemplate | "new") {
    setEditing(t);
    setBody(t === "new" ? "" : t.body);
    setError(null);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const result = await upsertTemplate({
      id: editing === "new" ? undefined : editing?.id,
      name: String(fd.get("name") ?? ""),
      stage: String(fd.get("stage") ?? "primer_contacto"),
      body,
      product_id: String(fd.get("product_id") ?? "") || null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  function insertVariable(variable: string) {
    setBody((b) => `${b}${b.endsWith(" ") || !b ? "" : " "}{{${variable}}}`);
  }

  const stages = Object.keys(TEMPLATE_STAGES);

  return (
    <div className="space-y-6">
      {canEdit && (
        <Button onClick={() => open("new")}>
          <Plus className="size-4" /> Nueva plantilla
        </Button>
      )}

      {templates.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No hay plantillas"
          description="Corré superadmin.sql para sembrar las iniciales, o creá una."
        />
      ) : (
        stages
          .filter((stage) => templates.some((t) => t.stage === stage))
          .map((stage) => (
            <section key={stage}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                {TEMPLATE_STAGES[stage]}
              </h2>
              <div className="space-y-2">
                {templates
                  .filter((t) => t.stage === stage)
                  .map((t) => (
                    <Card
                      key={t.id}
                      className={cn("flex items-start gap-3 py-3", !t.active && "opacity-50")}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{t.name}</p>
                          {!t.active && (
                            <Badge className="border-line text-muted">Inactiva</Badge>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{t.body}</p>
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => open(t)}
                            className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-fg"
                            title="Editar"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={async () => {
                              await toggleTemplate(t.id, !t.active);
                              router.refresh();
                            }}
                            className="rounded-lg px-2 text-[10px] font-semibold uppercase text-muted hover:bg-surface2 hover:text-fg"
                            title={t.active ? "Desactivar" : "Activar"}
                          >
                            {t.active ? "ON" : "OFF"}
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`¿Borrar "${t.name}"?`)) {
                                await deleteTemplate(t.id);
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
                    </Card>
                  ))}
              </div>
            </section>
          ))
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nueva plantilla" : "Editar plantilla"}
      >
        <form onSubmit={onSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-name">Nombre</Label>
              <Input
                id="t-name"
                name="name"
                required
                defaultValue={editing !== "new" ? editing?.name : ""}
                placeholder="Primer contacto"
              />
            </div>
            <div>
              <Label htmlFor="t-stage">Etapa</Label>
              <Select
                id="t-stage"
                name="stage"
                defaultValue={editing !== "new" ? editing?.stage : "primer_contacto"}
              >
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {TEMPLATE_STAGES[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="t-product">Producto (opcional)</Label>
            <Select
              id="t-product"
              name="product_id"
              defaultValue={editing !== "new" ? editing?.product_id ?? "" : ""}
            >
              <option value="">Genérica</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="t-body">Mensaje</Label>
            <Textarea
              id="t-body"
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hola {{nombre}} 👋 ..."
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="rounded-full border border-line bg-surface2 px-2.5 py-1 text-[11px] text-muted hover:border-accent/40 hover:text-accent"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
          {body && (
            <div className="rounded-lg border border-line bg-surface2 p-3">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-muted">Vista previa</p>
              <p className="whitespace-pre-wrap text-sm">{renderTemplate(body, SAMPLE)}</p>
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" loading={saving} className="w-full">
            Guardar
          </Button>
        </form>
      </Modal>
    </div>
  );
}
