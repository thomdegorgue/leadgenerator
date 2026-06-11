import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";
import { SegmentGauge } from "./segment-gauge";

/** Panel sólido con peso físico (borde inferior tipo tecla de consola). */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("tile p-4 sm:p-5", className)} {...props} />;
}

/** Métrica de cluster: número grande en mono + gauge segmentado. */
export function StatCard({
  label,
  value,
  hint,
  accent,
  gauge,
  gaugeTone,
  redline,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  /** 0..1 — enciende el gauge segmentado inferior. */
  gauge?: number;
  gaugeTone?: "accent" | "success" | "warn" | "danger";
  redline?: number;
}) {
  return (
    <div className={cn("tile px-4 py-3.5", accent && "border-b-accent")}>
      <p className="microlabel">{label}</p>
      <p
        className={cn(
          "numeric mt-1.5 text-[26px] font-semibold leading-none tracking-tight sm:text-[30px]",
          accent ? "text-accent" : "text-fg"
        )}
      >
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </p>
      {gauge !== undefined && (
        <SegmentGauge
          ratio={gauge}
          tone={gaugeTone ?? (accent ? "accent" : "accent")}
          redline={redline}
          size="sm"
          className="mt-2.5"
        />
      )}
      {hint && <p className="mt-1.5 text-[11px] text-dim">{hint}</p>}
    </div>
  );
}

/** Fila de métricas del cluster. */
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
  return <div className={cn("grid grid-cols-2 gap-2", colsCls, className)}>{children}</div>;
}

/** Header de página: título display + subtítulo, separado por línea. */
export function PageHeader({
  title,
  sub,
  children,
}: {
  /** @deprecated sin uso en el estilo Cockpit */
  index?: string;
  title: string;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
