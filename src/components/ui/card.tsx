import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

/** Panel HUD: hairline, superficie técnica, esquinas mínimas. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[4px] border border-line bg-surface p-4 sm:p-5", className)}
      {...props}
    />
  );
}

/** Métrica para usar dentro de un StatStrip (sin borde propio). */
export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn("bg-surface px-4 py-3.5", accent && "hud-ticks")}>
      <p className="microlabel">{label}</p>
      <p
        className={cn(
          "numeric mt-1 text-[26px] font-semibold leading-none tracking-tight sm:text-[30px]",
          accent ? "text-accent" : "text-fg"
        )}
      >
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] text-dim">{hint}</p>}
    </div>
  );
}

/** Strip continuo de métricas separadas por hairlines (estilo instrumento). */
export function StatStrip({
  className,
  children,
  cols = 4,
}: {
  className?: string;
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5;
}) {
  const colsCls = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" }[cols];
  return (
    <div className={cn("grid grid-cols-2 gap-px border border-line bg-line", colsCls, className)}>
      {children}
    </div>
  );
}

/** Header de página estilo sistema: índice de módulo + título + subtítulo. */
export function PageHeader({
  index,
  title,
  sub,
  children,
}: {
  index: string;
  title: string;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
      <div>
        <p className="microlabel text-accent">
          {index} <span className="text-dim">/</span>
        </p>
        <h1 className="mt-1 font-display text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
