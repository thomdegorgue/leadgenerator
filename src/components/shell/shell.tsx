"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, LogOut } from "lucide-react";
import { navFor } from "./nav";
import { cn, initials } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="relative flex items-center justify-center rounded-lg bg-accent/10 border border-accent/30 p-1.5">
        <Eye className="size-4 text-accent" />
      </span>
      {!compact && (
        <span className="text-sm font-bold tracking-[0.3em] text-fg">ARGOS</span>
      )}
    </span>
  );
}

export function Sidebar({
  isAdmin,
  fullName,
  roleLabel,
}: {
  isAdmin: boolean;
  fullName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const items = navFor(isAdmin);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-accent/10 text-accent font-medium border border-accent/20"
                  : "text-muted hover:bg-surface2 hover:text-fg border border-transparent"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface2 text-xs font-semibold text-accent">
            {initials(fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{fullName}</p>
            <p className="text-[11px] uppercase tracking-wider text-muted">{roleLabel}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-danger"
              title="Cerrar sesión"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileTopbar({ fullName }: { fullName: string }) {
  return (
    <header className="glass sticky top-0 z-40 flex h-14 items-center justify-between px-4 md:hidden">
      <Link href="/">
        <Logo />
      </Link>
      <form action="/auth/signout" method="post" className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-surface2 text-xs font-semibold text-accent">
          {initials(fullName)}
        </span>
        <button className="rounded-lg p-1.5 text-muted hover:text-danger" title="Cerrar sesión">
          <LogOut className="size-4" />
        </button>
      </form>
    </header>
  );
}

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = navFor(isAdmin).filter((i) => i.mobile).slice(0, 5);

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 flex justify-around pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              active ? "text-accent" : "text-muted"
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
