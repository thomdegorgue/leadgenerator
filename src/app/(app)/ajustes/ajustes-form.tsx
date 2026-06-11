"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { updateOrgSettings } from "@/server/org";

export function AjustesForm({ recycleDays, dailyGoal }: { recycleDays: number; dailyGoal: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const result = await updateOrgSettings({
      recycleDays: parseInt(String(fd.get("recycle") ?? "4"), 10) || 4,
      dailyGoal: parseInt(String(fd.get("goal") ?? "30"), 10) || 30,
    });
    setSaving(false);
    setMessage(result.ok ? "✅ Guardado." : `⚠️ ${result.error}`);
    router.refresh();
  }

  return (
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
          <p className="mt-1 text-[11px] text-muted">Se muestra como objetivo en el Modo Focus.</p>
        </div>
        {message && <p className="text-xs text-muted">{message}</p>}
        <Button type="submit" loading={saving} className="w-full">
          Guardar
        </Button>
      </form>
    </Card>
  );
}
