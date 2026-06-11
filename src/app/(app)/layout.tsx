import { getCtx } from "@/lib/auth";
import { Sidebar, BottomNav, MobileTopbar } from "@/components/shell/shell";
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
      <Sidebar isAdmin={ctx.isAdmin} fullName={fullName} roleLabel={roleLabel} />
      <MobileTopbar fullName={fullName} />
      <main className="px-4 pb-24 pt-4 sm:px-6 md:ml-60 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <BottomNav isAdmin={ctx.isAdmin} />
      <CommandPalette isAdmin={ctx.isAdmin} />
    </div>
  );
}
