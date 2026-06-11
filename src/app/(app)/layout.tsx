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

  return (
    <div className="min-h-dvh">
      <StatusBar fullName={fullName} />
      <Sidebar isAdmin={ctx.isAdmin} roleLabel={`${roleLabel} · ${ctx.org.name}`} />
      <main className="px-4 pb-28 pt-16 sm:px-6 md:ml-48 md:pb-10 md:pt-[4.5rem]">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <BottomNav isAdmin={ctx.isAdmin} />
      <CommandPalette isAdmin={ctx.isAdmin} />
    </div>
  );
}
