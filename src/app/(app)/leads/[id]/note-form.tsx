"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { addNote } from "@/server/leads";

export function NoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    await addNote(leadId, note);
    setNote("");
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Agregar una nota al historial…"
      />
      <Button type="submit" variant="secondary" loading={saving} disabled={!note.trim()}>
        Anotar
      </Button>
    </form>
  );
}
