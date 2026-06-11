"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { STATUS, STATUS_ORDER } from "@/lib/status";
import { updateLeadStatus } from "@/server/leads";
import { cn, initials } from "@/lib/utils";
import type { LeadStatus } from "@/lib/types";

export interface BoardLead {
  id: string;
  name: string;
  city: string | null;
  status: LeadStatus;
  score: number | null;
  assignee: string | null;
}

function LeadCard({ lead, overlay = false }: { lead: BoardLead; overlay?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface2 p-3 text-left shadow-sm",
        overlay && "glow-accent rotate-2 border-accent/50"
      )}
    >
      <p className="truncate text-sm font-medium">{lead.name}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted">{lead.city ?? "—"}</p>
        <span className="flex shrink-0 items-center gap-1.5">
          {lead.score != null && (
            <span
              className={cn(
                "numeric rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                lead.score >= 75
                  ? "bg-success/15 text-success"
                  : lead.score >= 45
                    ? "bg-warn/15 text-warn"
                    : "bg-surface text-muted"
              )}
            >
              {lead.score}
            </span>
          )}
          {lead.assignee && (
            <span
              className="flex size-5 items-center justify-center rounded-full bg-surface text-[9px] font-semibold text-accent"
              title={lead.assignee}
            >
              {initials(lead.assignee)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function DraggableCard({ lead, onOpen }: { lead: BoardLead; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={cn("cursor-grab touch-manipulation active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <LeadCard lead={lead} />
    </div>
  );
}

function Column({
  status,
  leads,
  onOpen,
}: {
  status: LeadStatus;
  leads: BoardLead[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg = STATUS[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-xl border border-line bg-surface/60 transition-colors",
        isOver && "border-accent/50 bg-accent/5"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className={cn("size-2 rounded-full", cfg.dot)} />
        <p className="text-xs font-semibold uppercase tracking-wider">{cfg.label}</p>
        <span className="numeric ml-auto rounded-full bg-surface2 px-2 py-0.5 text-[10px] text-muted">
          {leads.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: "calc(100dvh - 250px)" }}>
        {leads.map((lead) => (
          <DraggableCard key={lead.id} lead={lead} onOpen={() => onOpen(lead.id)} />
        ))}
      </div>
    </div>
  );
}

export function Board({ initialLeads }: { initialLeads: BoardLead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // El tablero se actualiza solo cuando otro usuario mueve leads (Realtime)
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pipeline-leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 1200);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const leadId = String(e.active.id);
    const target = e.over?.id as LeadStatus | undefined;
    if (!target || !STATUS_ORDER.includes(target)) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === target) return;

    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: target } : l)));
    void updateLeadStatus(leadId, target);
  }

  const activeLead = leads.find((l) => l.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            leads={leads.filter((l) => l.status === status)}
            onOpen={(id) => router.push(`/leads/${id}`)}
          />
        ))}
      </div>
      <DragOverlay>{activeLead && <LeadCard lead={activeLead} overlay />}</DragOverlay>
    </DndContext>
  );
}
