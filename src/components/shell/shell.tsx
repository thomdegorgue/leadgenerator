"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu, X } from "lucide-react";
import { navFor } from "./nav";
import { SegmentGauge } from "@/components/ui/segment-gauge";
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

/** Menú hamburguesa mobile: acceso a TODAS las secciones. */
function MobileMenu({ isAdmin, fullName, roleLabel }: { isAdmin: boolean; fullName: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = navFor(isAdmin);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        className="rounded-[6px] p-1.5 text-muted hover:bg-surface2 hover:text-fg"
        aria-label="Abrir menú"
      >
        <Menu className="size-5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-surface2"
            >
              <div className="flex h-11 items-center justify-between border-b border-line px-4">
                <Logo />
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-[6px] p-1.5 text-muted hover:text-fg"
                  aria-label="Cerrar menú"
                >
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-2">
                {items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-[7px] px-3 py-3 transition-colors",
                        active
                          ? "border border-accent/25 bg-accent/[0.08] text-accent"
                          : "border border-transparent text-muted"
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-line px-4 py-3">
                <p className="text-sm font-medium">{fullName}</p>
                <p className="microlabel mt-0.5">{roleLabel}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Barra de estado: el tablero siempre visible. */
export function StatusBar({
  fullName,
  roleLabel,
  isAdmin,
  todayCount,
  dailyGoal,
}: {
  fullName: string;
  roleLabel: string;
  isAdmin: boolean;
  todayCount: number;
  dailyGoal: number;
}) {
  const goalReached = todayCount >= dailyGoal;
  return (
    <header className="glass fixed inset-x-0 top-0 z-50 flex h-11 items-center gap-2 border-x-0 border-t-0 px-2 sm:gap-3 sm:px-4">
      <MobileMenu isAdmin={isAdmin} fullName={fullName} roleLabel={roleLabel} />
      <Link href="/" className="shrink-0">
        <Logo />
      </Link>
      <span className="microlabel hidden lg:block">Sistema Operativo Comercial</span>
      <span className="flex-1" />

      <span className="flex items-center gap-2" title={`Meta diaria: ${todayCount}/${dailyGoal} contactos`}>
        <span className="microlabel hidden sm:block">Meta</span>
        <SegmentGauge
          ratio={dailyGoal > 0 ? todayCount / dailyGoal : 0}
          segments={6}
          size="sm"
          tone={goalReached ? "success" : "accent"}
          className="w-12 sm:w-14"
        />
        <span className={cn("numeric text-[11px]", goalReached ? "text-success" : "text-muted")}>
          {todayCount}/{dailyGoal}
        </span>
      </span>

      <span className="hidden h-4 w-px bg-line sm:block" />
      <span className="hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-success sm:flex">
        <span className="pulse-dot size-1.5 rounded-full bg-success" />
        En línea
      </span>
      <span className="hidden sm:block">
        <Clock />
      </span>
      <span className="hidden h-4 w-px bg-line sm:block" />
      <span className="hidden size-7 items-center justify-center rounded-[6px] border border-line bg-surface2 text-[10px] font-bold text-accent sm:flex">
        {initials(fullName)}
      </span>
      <form action="/auth/signout" method="post">
        <button
          className="rounded-[6px] p-1.5 text-dim hover:bg-surface2 hover:text-danger"
          title="Cerrar sesión"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </header>
  );
}

/** Navegación lateral: el módulo activo es la marcha engranada. */
export function Sidebar({ isAdmin, roleLabel }: { isAdmin: boolean; roleLabel: string }) {
  const pathname = usePathname();
  const items = navFor(isAdmin);

  return (
    <aside className="fixed bottom-0 left-0 top-11 z-40 hidden w-48 flex-col border-r border-line bg-surface2 md:flex">
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-[7px] px-3 py-2.5 transition-colors",
                active
                  ? "border border-accent/25 bg-accent/[0.08] text-accent"
                  : "border border-transparent text-muted hover:bg-surface hover:text-fg"
              )}
            >
              <span
                className={cn(
                  "size-1 rounded-full",
                  active ? "bg-accent" : "bg-transparent"
                )}
              />
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

/** Dock mobile con el botón START (Focus) al centro. */
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
                "glow-accent -mt-5 flex size-12 flex-col items-center justify-center rounded-full border-4 border-bg",
                isActive(pathname, "/focus") ? "bg-accent-strong" : "bg-accent"
              )}
              style={{ boxShadow: "0 0 0 1.5px color-mix(in srgb, var(--accent) 40%, transparent)" }}
            >
              <focus.icon className="size-4 text-bg" />
              <span className="text-[6px] font-bold tracking-[0.14em] text-bg">START</span>
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
