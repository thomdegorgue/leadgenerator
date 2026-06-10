"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/field";
import { STATUS, STATUS_ORDER } from "@/lib/status";
import { assignLead, discardLead, updateLeadStatus } from "@/server/leads";
import type { LeadStatus } from "@/lib/types";

export function LeadControls({
  leadId,
  status,
  assignedTo,
  isAdmin,
  members,
}: {
  leadId: string;
  status: LeadStatus;
  assignedTo: string | null;
  isAdmin: boolean;
  members: { userId: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4">
      <div>
        <Label htmlFor="status">Estado</Label>
        <Select
          id="status"
          value={status}
          disabled={pending}
          onChange={(e) => run(() => updateLeadStatus(leadId, e.target.value as LeadStatus))}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </Select>
      </div>

      {isAdmin && (
        <div>
          <Label htmlFor="assignee">Asignado a</Label>
          <Select
            id="assignee"
            value={assignedTo ?? ""}
            disabled={pending}
            onChange={(e) => run(() => assignLead(leadId, e.target.value || null))}
          >
            <option value="">Sin asignar</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {status !== "descartado" &&
        (confirmDiscard ? (
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              onClick={() => run(() => discardLead(leadId))}
              className="flex-1"
            >
              Confirmar descarte
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDiscard(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDiscard(true)} className="w-full">
            Descartar lead
          </Button>
        ))}
    </Card>
  );
}
