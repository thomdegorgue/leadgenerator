"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLead } from "@/server/leads";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Card } from "@/components/ui/card";

export function NewLeadForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const result = await createLead({
      name: String(fd.get("name") ?? ""),
      category: String(fd.get("category") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      website: String(fd.get("website") ?? ""),
      instagram: String(fd.get("instagram") ?? ""),
      address: String(fd.get("address") ?? ""),
      city: String(fd.get("city") ?? ""),
      province: String(fd.get("province") ?? ""),
    });

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/leads/${result.id}`);
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Nombre del negocio *</Label>
          <Input id="name" name="name" required placeholder="Distribuidora ABC" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="category">Rubro</Label>
            <Input id="category" name="category" placeholder="Distribuidora" />
          </div>
          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" name="phone" placeholder="11 5555 5555" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" name="city" placeholder="CABA" />
          </div>
          <div>
            <Label htmlFor="province">Provincia</Label>
            <Input id="province" name="province" placeholder="Buenos Aires" />
          </div>
        </div>
        <div>
          <Label htmlFor="address">Dirección</Label>
          <Input id="address" name="address" placeholder="Av. Corrientes 1234" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="website">Web</Label>
            <Input id="website" name="website" placeholder="negocio.com.ar" />
          </div>
          <div>
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" name="instagram" placeholder="@negocio" />
          </div>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="hola@negocio.com.ar" />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          Guardar lead
        </Button>
      </form>
    </Card>
  );
}
