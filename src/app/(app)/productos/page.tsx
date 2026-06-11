import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import type { Product } from "@/lib/types";
import { ProductsClient } from "./products-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Productos" };

// El recálculo masivo de scores puede tardar en bases grandes
export const maxDuration = 300;

export default async function ProductosPage() {
  const ctx = await getCtx();
  if (!ctx.isAdmin) redirect("/");

  const [{ data: products }, { count: leadCount }] = await Promise.all([
    ctx.supabase.from("products").select("*").eq("org_id", ctx.org.id).order("created_at"),
    ctx.supabase.from("leads").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Productos</h1>
        <p className="text-sm text-muted">
          Cada SaaS o servicio que vendés. El score y la IA se adaptan solos al darlos de alta.
        </p>
      </header>
      <ProductsClient
        products={(products ?? []) as Product[]}
        isOwner={ctx.profile.is_super_admin || ctx.role === "owner"}
        leadCount={leadCount ?? 0}
      />
    </div>
  );
}
