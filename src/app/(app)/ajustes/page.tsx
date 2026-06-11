import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
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
      <PageHeader index="11" title="Ajustes" sub={ctx.org.name} />
      <AjustesForm
        recycleDays={settings.recycle_days ?? 4}
        dailyGoal={settings.daily_goal ?? 30}
      />
    </div>
  );
}
