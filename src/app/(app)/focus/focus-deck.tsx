"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CalendarClock,
  MessageCircle,
  PhoneOff,
  SkipForward,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { renderTemplate, templateVars, waLink, TEMPLATE_STAGES } from "@/lib/whatsapp";
import {
  discardLead,
  logWhatsAppContact,
  logWhatsAppResult,
  scheduleFollowup,
} from "@/server/leads";
import type { LeadStatus, MessageTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface FocusLead {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  phone: string | null;
  phoneE164: string | null;
  status: LeadStatus;
  overdue: boolean;
  priority: number;
  topScore: { score: number; product: string } | null;
  speech: string | null;
  argumento: string | null;
}

type Phase = "card" | "result";

export function FocusDeck({
  initialQueue,
  templates,
  vendedorName,
  todayCount,
  dailyGoal,
}: {
  initialQueue: FocusLead[];
  templates: MessageTemplate[];
  vendedorName: string;
  todayCount: number;
  dailyGoal: number;
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [phase, setPhase] = useState<Phase>("card");
  const [contacts, setContacts] = useState(todayCount);
  const [sessionDone, setSessionDone] = useState(0);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [useSpeech, setUseSpeech] = useState(true);
  const [busy, setBusy] = useState(false);

  const lead = queue[0] ?? null;
  const template = templates.find((t) => t.id === templateId);

  const message = useMemo(() => {
    if (!lead) return "";
    if (useSpeech && lead.speech) return lead.speech;
    if (!template) return "";
    return renderTemplate(
      template.body,
      templateVars({ name: lead.name, city: lead.city, category: lead.category }, vendedorName)
    );
  }, [lead, template, useSpeech, vendedorName]);

  function advance() {
    setQueue((q) => q.slice(1));
    setPhase("card");
    setSessionDone((n) => n + 1);
  }

  async function openWhatsApp() {
    if (!lead?.phoneE164) return;
    window.open(waLink(lead.phoneE164, message), "_blank");
    setPhase("result");
    setContacts((n) => n + 1);
    await logWhatsAppContact(lead.id, useSpeech && lead.speech ? "Speech IA" : template?.name ?? "Focus");
  }

  async function result(r: "respondio" | "sin_respuesta" | "numero_invalido") {
    if (!lead) return;
    setBusy(true);
    await logWhatsAppResult(lead.id, r);
    setBusy(false);
    advance();
  }

  async function snooze(days: number) {
    if (!lead) return;
    setBusy(true);
    await scheduleFollowup(lead.id, days);
    setBusy(false);
    advance();
  }

  async function discard() {
    if (!lead) return;
    setBusy(true);
    await discardLead(lead.id, "no_contesta");
    setBusy(false);
    advance();
  }

  const goalProgress = Math.min((contacts / dailyGoal) * 100, 100);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-160px)] max-w-md flex-col">
      {/* Header: meta diaria */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            <Zap className="size-4 text-accent" /> Modo Focus
          </p>
          <p className="numeric text-muted">
            <span className={cn(contacts >= dailyGoal && "text-success")}>{contacts}</span>/{dailyGoal} hoy
            {sessionDone > 0 && <span className="ml-2 text-accent">· {sessionDone} esta sesión</span>}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2">
          <motion.div
            className={cn("h-full rounded-full", contacts >= dailyGoal ? "bg-success" : "bg-accent")}
            animate={{ width: `${goalProgress}%` }}
            transition={{ type: "spring", damping: 20 }}
          />
        </div>
      </div>

      {!lead ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="text-4xl">🏁</span>
          <p className="font-semibold">Cola vacía. Crack.</p>
          <p className="max-w-xs text-sm text-muted">
            No te queda nada priorizado. Pedile leads a tu manager o revisá el{" "}
            <Link href="/pipeline" className="text-accent hover:underline">
              pipeline
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="relative flex-1">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, x: 240, rotate: 6, transition: { duration: 0.22 } }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="glass flex h-full flex-col rounded-2xl p-5"
            >
              {/* Prioridad */}
              <div className="mb-3 flex items-center gap-2">
                {lead.status === "respondio" ? (
                  <span className="rounded-full bg-violet-400/15 px-2.5 py-1 text-[11px] font-semibold text-violet-300">
                    💬 Respondió — contestale
                  </span>
                ) : lead.overdue ? (
                  <span className="rounded-full bg-danger/15 px-2.5 py-1 text-[11px] font-semibold text-danger">
                    ⏰ Seguimiento vencido
                  </span>
                ) : (
                  <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent">
                    ✨ Nuevo para vos
                  </span>
                )}
                <span className="flex-1" />
                <StatusBadge status={lead.status} />
              </div>

              {/* Negocio */}
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/leads/${lead.id}`} className="hover:text-accent">
                    <h2 className="text-lg font-semibold leading-tight">{lead.name}</h2>
                  </Link>
                  <p className="mt-0.5 text-sm text-muted">
                    {[lead.category, lead.city].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {lead.topScore && <ScoreRing score={lead.topScore.score} size={56} />}
              </div>
              {lead.topScore && (
                <p className="mt-1 text-xs text-muted">
                  Mejor fit: <span className="text-fg">{lead.topScore.product}</span>
                </p>
              )}
              {lead.argumento && (
                <p className="mt-3 rounded-lg border border-violet-400/20 bg-violet-400/5 p-2.5 text-xs text-fg/90">
                  <Sparkles className="mr-1 inline size-3 text-violet-300" />
                  {lead.argumento}
                </p>
              )}

              {/* Mensaje */}
              <div className="mt-4 flex-1">
                {phase === "card" ? (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      {lead.speech && (
                        <button
                          onClick={() => setUseSpeech(true)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium",
                            useSpeech ? "bg-violet-400/20 text-violet-300" : "bg-surface2 text-muted"
                          )}
                        >
                          ✨ Speech IA
                        </button>
                      )}
                      <button
                        onClick={() => setUseSpeech(false)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-medium",
                          !useSpeech || !lead.speech ? "bg-accent/20 text-accent" : "bg-surface2 text-muted"
                        )}
                      >
                        Plantilla
                      </button>
                      {(!useSpeech || !lead.speech) && templates.length > 0 && (
                        <Select
                          value={templateId}
                          onChange={(e) => setTemplateId(e.target.value)}
                          className="h-8 flex-1 text-xs"
                        >
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {TEMPLATE_STAGES[t.stage] ?? t.stage} · {t.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>
                    <p className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface2/70 p-3 text-sm text-fg/90">
                      {message || "Sin mensaje disponible — creá plantillas."}
                    </p>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3">
                    <p className="text-sm font-medium">¿Cómo fue?</p>
                    <div className="grid w-full grid-cols-3 gap-2">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => result("respondio")}
                        className="border-success/40 text-success"
                      >
                        <Check className="size-4" /> Respondió
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => result("sin_respuesta")}>
                        <X className="size-4" /> Nada
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => result("numero_invalido")}
                        className="border-danger/40 text-danger"
                      >
                        <PhoneOff className="size-4" /> Inválido
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Acciones */}
              {phase === "card" && (
                <div className="mt-4 space-y-2">
                  <Button
                    onClick={openWhatsApp}
                    disabled={!lead.phoneE164 || !message}
                    size="lg"
                    className="w-full"
                  >
                    <MessageCircle className="size-5" />
                    {lead.phoneE164 ? "Abrir WhatsApp" : "Sin teléfono válido"}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => snooze(3)} className="flex-1">
                      <CalendarClock className="size-3.5" /> +3d
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={discard} className="flex-1 text-danger/80">
                      <Trash2 className="size-3.5" /> Descartar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setQueue((q) => [...q.slice(1), q[0]]);
                        setPhase("card");
                      }}
                      className="flex-1"
                    >
                      <SkipForward className="size-3.5" /> Saltar
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {lead && (
        <p className="numeric mt-3 text-center text-xs text-muted">
          {queue.length} en cola
        </p>
      )}
    </div>
  );
}
