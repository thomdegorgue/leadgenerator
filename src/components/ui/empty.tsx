import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="tile flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="inset mb-3 p-3 text-dim">
        <Icon className="size-6" />
      </div>
      <p className="font-display text-sm font-medium">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-xs text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
