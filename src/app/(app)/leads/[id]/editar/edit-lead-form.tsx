"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateLead } from "@/server/leads";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import type { Lead } from "@/lib/types";

export function EditLeadForm({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");
    const result = await updateLead(lead.id, {
      name: get("name"),
      category: get("category"),
      phone: get("phone"),
      email: get("email"),
      website: get("website"),
      instagram: get("instagram"),
      address: get("address"),
      city: get("city"),
      province: get("province"),
    });

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/leads/${lead.id}`);
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Nombre del negocio *</Label>
          <Input id="name" name="name" required defaultValue={lead.name} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="category">Rubro</Label>
            <Input id="category" name="category" defaultValue={lead.category ?? ""} />
          </div>
          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" name="phone" defaultValue={lead.phone ?? ""} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" name="city" defaultValue={lead.city ?? ""} />
          </div>
          <div>
            <Label htmlFor="province">Provincia</Label>
            <Input id="province" name="province" defaultValue={lead.province ?? ""} />
          </div>
        </div>
        <div>
          <Label htmlFor="address">Dirección</Label>
          <Input id="address" name="address" defaultValue={lead.address ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="website">Web</Label>
            <Input id="website" name="website" defaultValue={lead.website ?? ""} />
          </div>
          <div>
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" name="instagram" defaultValue={lead.instagram ?? ""} />
          </div>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={lead.email ?? ""} />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={loading} className="flex-1">
            Guardar cambios
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
