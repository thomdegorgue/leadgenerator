"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Copy, Check, MessageCircle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateAnalysis } from "@/server/intel";
import { logWhatsAppContact } from "@/server/leads";
import { waLink } from "@/lib/whatsapp";
import type { AiAnalysis } from "@/lib/ai";

export function AiPanel({
  leadId,
  phoneE164,
  initialAnalysis,
}: {
  leadId: string;
  phoneE164: string | null;
  initialAnalysis: AiAnalysis | null;
}) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(initialAnalysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    const result = await generateAnalysis(leadId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAnalysis(result.analysis);
    router.refresh();
  }

  async function copySpeech() {
    if (!analysis) return;
    await navigator.clipboard.writeText(analysis.speech);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendSpeech() {
    if (!analysis || !phoneE164) return;
    window.open(waLink(phoneE164, analysis.speech), "_blank");
    await logWhatsAppContact(leadId, "Speech IA");
    router.refresh();
  }

  return (
    <Card className="border-violet-400/25">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-violet-300" />
          <h2 className="microlabel text-fg">Análisis IA</h2>
        </div>
        {analysis && (
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-muted hover:text-fg disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Regenerar
          </button>
        )}
      </div>

      {!analysis ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Claude analiza el negocio y te arma el diagnóstico + el speech de venta personalizado.
          </p>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button onClick={generate} loading={loading} className="w-full" variant="secondary">
            <Sparkles className="size-4" /> Generar análisis con IA
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 text-sm"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-danger/80">
              Problema detectado
            </p>
            <p className="mt-0.5 text-fg/90">{analysis.problema}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-success/80">
              Oportunidad
            </p>
            <p className="mt-0.5 text-fg/90">{analysis.oportunidad}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-accent/80">
              Argumento de venta
            </p>
            <p className="mt-0.5 text-fg/90">{analysis.argumento}</p>
          </div>

          <div className="rounded-lg border border-violet-400/20 bg-violet-400/5 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              Speech sugerido
            </p>
            <p className="whitespace-pre-wrap text-fg/90">{analysis.speech}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" onClick={copySpeech} className="flex-1">
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                Copiar
              </Button>
              {phoneE164 && (
                <Button size="sm" onClick={sendSpeech} className="flex-1">
                  <MessageCircle className="size-3.5" /> Enviar por WhatsApp
                </Button>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </motion.div>
      )}
    </Card>
  );
}
