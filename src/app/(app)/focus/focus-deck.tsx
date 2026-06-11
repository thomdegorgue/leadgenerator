"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  PhoneOff,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { SegmentGauge } from "@/components/ui/segment-gauge";
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

const SWIPE_OFFSET = 90;
const SWIPE_VELOCITY = 600;

const cardVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0, scale: 0.96 }),
};

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
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [phase, setPhase] = useState<Phase>("card");
  const [contacts, setContacts] = useState(todayCount);
  const [sessionDone, setSessionDone] = useState(0);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [useSpeech, setUseSpeech] = useState(true);
  const [busy, setBusy] = useState(false);

  const lead = queue[index] ?? null;
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

  /** Navega sin resolver: izquierda = siguiente, derecha = anterior. */
  function go(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= queue.length) return;
    setDirection(delta);
    setIndex(next);
    setPhase("card");
    setUseSpeech(true);
  }

  /** El lead actual quedó resuelto: sale de la cola, avanza al que sigue. */
  function resolveCurrent() {
    const next = queue.filter((_, i) => i !== index);
    setQueue(next);
    setIndex(Math.min(index, Math.max(next.length - 1, 0)));
    setDirection(1);
    setPhase("card");
    setUseSpeech(true);
    setSessionDone((n) => n + 1);
  }

  // Flechas del teclado en desktop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, queue.length]);

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
    if (navigator.vibrate && r === "respondio") navigator.vibrate(40);
    resolveCurrent();
  }

  async function snooze(days: number) {
    if (!lead) return;
    setBusy(true);
    await scheduleFollowup(lead.id, days);
    setBusy(false);
    resolveCurrent();
  }

  async function discard() {
    if (!lead) return;
    setBusy(true);
    await discardLead(lead.id, "no_contesta");
    setBusy(false);
    resolveCurrent();
  }

  const goalProgress = Math.min((contacts / dailyGoal) * 100, 100);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-170px)] max-w-md flex-col">
      {/* Meta diaria */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm">
          <p className="microlabel flex items-center gap-1.5 text-fg">
            <Zap className="size-3.5 text-accent" /> Modo Focus
          </p>
          <p className="numeric text-muted">
            <span className={cn(contacts >= dailyGoal && "text-success")}>{contacts}</span>/{dailyGoal} hoy
            {sessionDone > 0 && <span className="ml-2 text-accent">· {sessionDone} resueltos</span>}
          </p>
        </div>
        <SegmentGauge
          ratio={goalProgress / 100}
          segments={12}
          tone={contacts >= dailyGoal ? "success" : "accent"}
          className="mt-2"
        />
      </div>

      {!lead ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="inset flex size-14 items-center justify-center text-success">
            <Check className="size-7" />
          </span>
          <p className="font-display font-semibold">Cola completada</p>
          <p className="max-w-xs text-sm text-muted">
            No te queda nada priorizado. Pedile leads a tu manager o revisá el{" "}
            <Link href="/pipeline" className="text-accent hover:underline">
              pipeline
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          {/* Navegación entre leads */}
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => go(-1)}
              disabled={index === 0}
              className="flex items-center gap-1 rounded-[6px] px-2 py-1.5 text-xs text-muted hover:bg-surface2 hover:text-fg disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Lead anterior"
            >
              <ChevronLeft className="size-4" /> Anterior
            </button>
            <span className="numeric text-[11px] text-dim">
              {index + 1} / {queue.length}
            </span>
            <button
              onClick={() => go(1)}
              disabled={index >= queue.length - 1}
              className="flex items-center gap-1 rounded-[6px] px-2 py-1.5 text-xs text-muted hover:bg-surface2 hover:text-fg disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Lead siguiente"
            >
              Siguiente <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="relative flex-1 overflow-x-clip">
            <AnimatePresence mode="popLayout" custom={direction}>
              <motion.div
                key={lead.id}
                custom={direction}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", damping: 28, stiffness: 330 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -SWIPE_OFFSET || info.velocity.x < -SWIPE_VELOCITY) go(1);
                  else if (info.offset.x > SWIPE_OFFSET || info.velocity.x > SWIPE_VELOCITY) go(-1);
                }}
                className="tile flex h-full cursor-grab flex-col rounded-[14px] border-b-[3px] p-5 active:cursor-grabbing"
              >
                {/* Prioridad */}
                <div className="mb-3 flex items-center gap-2">
                  {lead.status === "respondio" ? (
                    <span className="flex items-center gap-1.5 rounded-[4px] border border-violet-400/40 bg-violet-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-300">
                      <MessageCircle className="size-3" /> Respondió — contestale
                    </span>
                  ) : lead.overdue ? (
                    <span className="flex items-center gap-1.5 rounded-[4px] border border-danger/40 bg-danger/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-danger">
                      <CalendarClock className="size-3" /> Seguimiento vencido
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-[4px] border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                      <Zap className="size-3" /> Nuevo para vos
                    </span>
                  )}
                  <span className="flex-1" />
                  <StatusBadge status={lead.status} />
                </div>

                {/* Negocio */}
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${lead.id}`} className="hover:text-accent">
                      <h2 className="font-display text-lg font-semibold leading-tight">{lead.name}</h2>
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
                  <p className="inset mt-3 border-l-2 border-violet-400/50 p-2.5 text-xs text-fg/90">
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
                              "flex items-center gap-1 rounded-[4px] px-2.5 py-1 text-[11px] font-medium",
                              useSpeech ? "bg-violet-400/20 text-violet-300" : "bg-surface2 text-muted"
                            )}
                          >
                            <Sparkles className="size-3" /> Speech IA
                          </button>
                        )}
                        <button
                          onClick={() => setUseSpeech(false)}
                          className={cn(
                            "rounded-[4px] px-2.5 py-1 text-[11px] font-medium",
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
                      <p className="inset max-h-36 overflow-y-auto whitespace-pre-wrap p-3 text-sm text-fg/90">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={discard}
                        className="flex-1 text-danger/80"
                      >
                        <Trash2 className="size-3.5" /> Descartar
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <p className="mt-3 text-center text-[11px] text-dim">
            Deslizá la tarjeta o usá las flechas para moverte sin resolver
          </p>
        </>
      )}
    </div>
  );
}
