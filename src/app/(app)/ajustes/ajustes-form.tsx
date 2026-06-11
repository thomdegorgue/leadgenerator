"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { updateMyName, updateOrgSettings } from "@/server/org";

export function AjustesForm({
  recycleDays,
  dailyGoal,
  currentName,
}: {
  recycleDays: number;
  dailyGoal: number;
  currentName: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const result = await updateOrgSettings({
      recycleDays: parseInt(String(fd.get("recycle") ?? "4"), 10) || 4,
      dailyGoal: parseInt(String(fd.get("goal") ?? "30"), 10) || 30,
    });
    setSaving(false);
    setMessage(result.ok ? "Guardado." : result.error);
    router.refresh();
  }

  async function onSaveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameSaving(true);
    const fd = new FormData(e.currentTarget);
    const result = await updateMyName(String(fd.get("name") ?? ""));
    setNameSaving(false);
    setNameMessage(result.ok ? "Nombre actualizado." : result.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={onSaveName} className="space-y-4">
          <div>
            <Label htmlFor="name">Tu nombre</Label>
            <Input id="name" name="name" defaultValue={currentName} placeholder="Nombre y apellido" />
            <p className="mt-1 text-[11px] text-muted">
              Se usa en los saludos, la actividad y las plantillas ({"{{vendedor}}"}).
            </p>
          </div>
          {nameMessage && <p className="text-xs text-muted">{nameMessage}</p>}
          <Button type="submit" variant="secondary" loading={nameSaving} className="w-full">
            Guardar nombre
          </Button>
        </form>
      </Card>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="recycle">Reciclaje: días sin respuesta antes de volver a la cola</Label>
            <Input id="recycle" name="recycle" type="number" min={1} max={60} defaultValue={recycleDays} />
            <p className="mt-1 text-[11px] text-muted">
              Un lead contactado sin respuesta vuelve como seguimiento pendiente pasados estos días.
            </p>
          </div>
          <div>
            <Label htmlFor="goal">Meta diaria de contactos por vendedor</Label>
            <Input id="goal" name="goal" type="number" min={1} max={500} defaultValue={dailyGoal} />
            <p className="mt-1 text-[11px] text-muted">
              Es el gauge de la barra superior y del Modo Focus.
            </p>
          </div>
          {message && <p className="text-xs text-muted">{message}</p>}
          <Button type="submit" loading={saving} className="w-full">
            Guardar configuración
          </Button>
        </form>
      </Card>
    </div>
  );
}
