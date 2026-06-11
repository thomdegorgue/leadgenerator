"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { navFor } from "./nav";
import { cn, initials } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Glifo del ojo: anillo + pupila. */
export function EyeGlyph({ size = 16 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full border-[1.5px] border-accent"
      style={{ width: size, height: size }}
    >
      <span
        className="absolute rounded-full bg-accent"
        style={{ width: size * 0.34, height: size * 0.34 }}
      />
    </span>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <EyeGlyph />
      {!compact && (
        <span className="font-display text-[13px] font-bold tracking-[0.35em] text-fg">ARGOS</span>
      )}
    </span>
  );
}

function Clock() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="numeric text-[11px] text-muted">{time ?? "--:--:--"}</span>;
}

/** Barra de estado superior: el sistema está vivo. */
export function StatusBar({ fullName }: { fullName: string }) {
  return (
    <header className="glass fixed inset-x-0 top-0 z-50 flex h-11 items-center gap-3 border-x-0 border-t-0 px-3 sm:px-4">
      <Link href="/" className="shrink-0">
        <Logo />
      </Link>
      <span className="microlabel hidden lg:block">Sistema Operativo Comercial</span>
      <span className="flex-1" />
      <span className="hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-success sm:flex">
        <span className="pulse-dot size-1.5 rounded-full bg-success" />
        En línea
      </span>
      <Clock />
      <span className="hidden h-4 w-px bg-line sm:block" />
      <span className="flex size-7 items-center justify-center rounded-[4px] border border-line bg-surface2 text-[10px] font-bold text-accent">
        {initials(fullName)}
      </span>
      <form action="/auth/signout" method="post">
        <button
          className="rounded-[4px] p-1.5 text-dim hover:bg-surface2 hover:text-danger"
          title="Cerrar sesión"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </header>
  );
}

/** Rail lateral desktop: módulos numerados. */
export function Sidebar({ isAdmin, roleLabel }: { isAdmin: boolean; roleLabel: string }) {
  const pathname = usePathname();
  const items = navFor(isAdmin);

  return (
    <aside className="fixed bottom-0 left-0 top-11 z-40 hidden w-48 flex-col border-r border-line bg-surface md:flex">
      <nav className="flex-1 overflow-y-auto py-3">
        {items.map(({ href, label, icon: Icon }, i) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 px-4 py-2.5 transition-colors",
                active ? "bg-accent/[0.06] text-accent" : "text-muted hover:bg-surface2 hover:text-fg"
              )}
            >
              {active && <span className="absolute inset-y-1 left-0 w-[2px] bg-accent" />}
              <span className={cn("numeric text-[9px]", active ? "text-accent/70" : "text-dim")}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <Icon className="size-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line px-4 py-3">
        <p className="microlabel">{roleLabel}</p>
      </div>
    </aside>
  );
}

/** Dock mobile: Focus como botón central elevado. */
export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const mobileItems = navFor(isAdmin).filter((i) => i.mobile);
  const focus = mobileItems.find((i) => i.href === "/focus");
  const rest = mobileItems.filter((i) => i.href !== "/focus").slice(0, 4);
  const left = rest.slice(0, 2);
  const right = rest.slice(2, 4);

  const item = ({ href, label, icon: Icon }: (typeof rest)[number]) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex flex-1 flex-col items-center gap-1 py-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors",
          active ? "text-accent" : "text-dim"
        )}
      >
        <Icon className="size-5" />
        {label}
      </Link>
    );
  };

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-stretch">
        {left.map(item)}
        {focus && (
          <Link href="/focus" className="flex flex-col items-center px-3" aria-label="Modo Focus">
            <span
              className={cn(
                "glow-accent -mt-5 flex size-12 items-center justify-center rounded-full border-4 border-bg",
                isActive(pathname, "/focus") ? "bg-accent-strong" : "bg-accent"
              )}
            >
              <focus.icon className="size-5 text-bg" />
            </span>
            <span
              className={cn(
                "pb-1.5 pt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]",
                isActive(pathname, "/focus") ? "text-accent" : "text-dim"
              )}
            >
              Focus
            </span>
          </Link>
        )}
        {right.map(item)}
      </div>
    </nav>
  );
}
