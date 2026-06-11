import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { AjustesForm } from "./ajustes-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  const ctx = await getCtx();
  if (!(ctx.profile.is_super_admin || ctx.role === "owner")) redirect("/");

  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.org.id)
    .single();

  const settings = (org?.settings as Record<string, number>) ?? {};

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Ajustes</h1>
        <p className="text-sm text-muted">{ctx.org.name}</p>
      </header>
      <AjustesForm
        recycleDays={settings.recycle_days ?? 4}
        dailyGoal={settings.daily_goal ?? 30}
      />
    </div>
  );
}
