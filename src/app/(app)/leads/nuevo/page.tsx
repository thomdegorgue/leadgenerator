import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { NewLeadForm } from "./new-lead-form";

export const metadata = { title: "Nuevo lead" };

export default async function NuevoLeadPage() {
  const ctx = await getCtx();
  if (!ctx.isAdmin) redirect("/leads");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Nuevo lead</h1>
        <p className="text-sm text-muted">Carga manual. La dedup corre sola al guardar.</p>
      </header>
      <NewLeadForm />
    </div>
  );
}
