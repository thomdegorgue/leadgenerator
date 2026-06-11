import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        className
      )}
      {...props}
    />
  );
}
