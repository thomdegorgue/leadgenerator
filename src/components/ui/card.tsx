import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-line bg-surface p-4 sm:p-5", className)}
      {...props}
    />
  );
}

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
    <Card className={cn(accent && "border-accent/30")}>
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted">{label}</p>
      <p className={cn("numeric mt-1 text-3xl font-semibold", accent ? "text-accent" : "text-fg")}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
