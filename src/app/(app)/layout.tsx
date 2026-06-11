import { getCtx } from "@/lib/auth";
import { Sidebar, BottomNav, StatusBar } from "@/components/shell/shell";
import { CommandPalette } from "@/components/command-palette";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  vendedor: "Vendedor",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  const fullName = ctx.profile.full_name ?? "Usuario";
  const roleLabel = ctx.profile.is_super_admin ? "Super Admin" : ROLE_LABELS[ctx.role];

  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const [{ count: todayCount }, { data: org }] = await Promise.all([
    ctx.supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .eq("type", "whatsapp")
      .gte("created_at", startOfDay),
    ctx.supabase.from("organizations").select("settings").eq("id", ctx.org.id).single(),
  ]);
  const dailyGoal = Number((org?.settings as Record<string, unknown> | null)?.daily_goal) || 30;

  return (
    <div className="min-h-dvh">
      <StatusBar
        fullName={fullName}
        roleLabel={`${roleLabel} · ${ctx.org.name}`}
        isAdmin={ctx.isAdmin}
        todayCount={todayCount ?? 0}
        dailyGoal={dailyGoal}
      />
      <Sidebar isAdmin={ctx.isAdmin} roleLabel={`${roleLabel} · ${ctx.org.name}`} />
      <main className="px-4 pb-28 pt-16 sm:px-6 md:ml-48 md:pb-10 md:pt-[4.5rem]">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
      <BottomNav isAdmin={ctx.isAdmin} />
      <CommandPalette isAdmin={ctx.isAdmin} />
    </div>
  );
}
