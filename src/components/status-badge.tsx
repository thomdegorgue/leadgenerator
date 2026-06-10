import { Badge } from "@/components/ui/badge";
import { STATUS } from "@/lib/status";
import type { LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: LeadStatus }) {
  const cfg = STATUS[status];
  return (
    <Badge className={cfg.badge}>
      <span className={cn("size-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </Badge>
  );
}
