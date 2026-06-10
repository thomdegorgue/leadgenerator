"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { startGmapsSearch } from "@/server/bases";

export function GmapsForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const result = await startGmapsSearch({
      name: String(fd.get("name") ?? ""),
      niche: String(fd.get("niche") ?? ""),
      location: String(fd.get("location") ?? ""),
      count: parseInt(String(fd.get("count") ?? "100"), 10),
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    (e.target as HTMLFormElement).reset?.();
    router.refresh();
  }

  return (
    <Card className="border-accent/25">
      <div className="mb-3 flex items-center gap-2">
        <Radar className="size-4 text-accent" />
        <h2 className="text-sm font-semibold">Google Maps</h2>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="niche">Nicho *</Label>
            <Input id="niche" name="niche" required placeholder="Distribuidoras" />
          </div>
          <div>
            <Label htmlFor="location">Zona *</Label>
            <Input id="location" name="location" required placeholder="CABA, Argentina" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="count">Cantidad</Label>
            <Input id="count" name="count" type="number" min={1} max={10000} defaultValue={200} />
          </div>
          <div>
            <Label htmlFor="name">Nombre (opcional)</Label>
            <Input id="name" name="name" placeholder="Distribuidoras AMBA" />
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          Generar base
        </Button>
      </form>
    </Card>
  );
}
