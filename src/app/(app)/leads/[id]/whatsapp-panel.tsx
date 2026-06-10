"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Check, X, PhoneOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Textarea, Label } from "@/components/ui/field";
import { renderTemplate, templateVars, waLink, TEMPLATE_STAGES } from "@/lib/whatsapp";
import { logWhatsAppContact, logWhatsAppResult } from "@/server/leads";
import type { MessageTemplate } from "@/lib/types";

interface LeadSubset {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  phone: string | null;
  phone_e164: string | null;
}

export function WhatsAppPanel({
  lead,
  templates,
  vendedorName,
}: {
  lead: LeadSubset;
  templates: MessageTemplate[];
  vendedorName: string;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [editedText, setEditedText] = useState<string | null>(null);
  const [awaitingResult, setAwaitingResult] = useState(false);
  const [saving, setSaving] = useState(false);

  const template = templates.find((t) => t.id === templateId);
  const renderedText = useMemo(
    () => (template ? renderTemplate(template.body, templateVars(lead, vendedorName)) : ""),
    [template, lead, vendedorName]
  );
  const text = editedText ?? renderedText;

  const byStage = useMemo(() => {
    const groups = new Map<string, MessageTemplate[]>();
    templates.forEach((t) => groups.set(t.stage, [...(groups.get(t.stage) ?? []), t]));
    return groups;
  }, [templates]);

  async function openWhatsApp() {
    if (!lead.phone_e164 || !template) return;
    window.open(waLink(lead.phone_e164, text), "_blank");
    setAwaitingResult(true);
    await logWhatsAppContact(lead.id, template.name);
    router.refresh();
  }

  async function registerResult(result: "respondio" | "sin_respuesta" | "numero_invalido") {
    setSaving(true);
    await logWhatsAppResult(lead.id, result);
    setAwaitingResult(false);
    setSaving(false);
    router.refresh();
  }

  return (
    <Card className="border-accent/25">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="size-4 text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">WhatsApp</h2>
      </div>

      {!lead.phone_e164 ? (
        <p className="text-sm text-muted">
          {lead.phone
            ? `El teléfono "${lead.phone}" no se pudo normalizar a formato argentino. Editá el lead con un número válido.`
            : "Este lead no tiene teléfono cargado."}
        </p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted">No hay plantillas activas. Creá una en Plantillas.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="template">Plantilla</Label>
            <Select
              id="template"
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setEditedText(null);
              }}
            >
              {[...byStage.entries()].map(([stage, list]) => (
                <optgroup key={stage} label={TEMPLATE_STAGES[stage] ?? stage}>
                  {list.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>

          <Textarea
            value={text}
            onChange={(e) => setEditedText(e.target.value)}
            rows={4}
            aria-label="Mensaje"
          />

          <AnimatePresence mode="wait">
            {!awaitingResult ? (
              <motion.div key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Button onClick={openWhatsApp} className="w-full" size="lg">
                  <MessageCircle className="size-4" />
                  Abrir WhatsApp
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                <p className="text-center text-xs uppercase tracking-wider text-muted">
                  ¿Cómo fue? (1 tap y listo)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="secondary"
                    disabled={saving}
                    onClick={() => registerResult("respondio")}
                    className="border-success/40 text-success"
                  >
                    <Check className="size-4" /> Respondió
                  </Button>
                  <Button variant="secondary" disabled={saving} onClick={() => registerResult("sin_respuesta")}>
                    <X className="size-4" /> Nada aún
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={saving}
                    onClick={() => registerResult("numero_invalido")}
                    className="border-danger/40 text-danger"
                  >
                    <PhoneOff className="size-4" /> Inválido
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
