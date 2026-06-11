"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe2, Sparkles, AtSign, Square } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { enrichWebBatch, enrichInstagramBatch, aiScoreBatch } from "@/server/intel";

type BatchAction = () => Promise<
  { ok: true; processed: number; remaining: number } | { ok: false; error: string }
>;

function Runner({
  icon: Icon,
  title,
  description,
  pending,
  action,
  accent = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  pending: number;
  action: BatchAction;
  accent?: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [remaining, setRemaining] = useState(pending);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function run() {
    setRunning(true);
    setError(null);
    setProcessed(0);
    stopRef.current = false;

    let done = 0;
    // Loop de lotes hasta vaciar la cola (o que el usuario frene)
    for (;;) {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        break;
      }
      done += result.processed;
      setProcessed(done);
      setRemaining(result.remaining);
      if (result.remaining === 0 || result.processed === 0 || stopRef.current) break;
    }

    setRunning(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <span className={`rounded-lg p-2 ${accent ? "bg-accent/10 text-accent" : "bg-surface2 text-muted"}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : running ? (
            `${processed} procesados · ${remaining} en cola…`
          ) : remaining > 0 ? (
            `${remaining} leads pendientes — ${description}`
          ) : (
            "Todo al día ✓"
          )}
        </p>
      </div>
      {running ? (
        <Button variant="secondary" size="sm" onClick={() => (stopRef.current = true)}>
          <Square className="size-3.5" /> Frenar
        </Button>
      ) : (
        <Button
          variant={accent ? "primary" : "secondary"}
          size="sm"
          disabled={remaining === 0}
          onClick={run}
        >
          Procesar
        </Button>
      )}
    </div>
  );
}

export function IntelPanel({
  webPending,
  igPending,
  aiPending,
  igAvailable,
  aiAvailable,
}: {
  webPending: number;
  igPending: number;
  aiPending: number;
  igAvailable: boolean;
  aiAvailable: boolean;
}) {
  return (
    <Card className="divide-y divide-line py-1 sm:py-1">
      <Runner
        icon={Globe2}
        title="Enriquecer por web"
        description="visita el sitio y detecta ecommerce, catálogo y WhatsApp. Gratis."
        pending={webPending}
        action={enrichWebBatch}
      />
      {igAvailable && (
        <Runner
          icon={AtSign}
          title="Enriquecer Instagram"
          description="seguidores y bio vía Apify (consume crédito)."
          pending={igPending}
          action={enrichInstagramBatch}
        />
      )}
      {aiAvailable && (
        <Runner
          icon={Sparkles}
          title="Mejorar scores con IA"
          description="Claude recalifica cada lead por producto."
          pending={aiPending}
          action={aiScoreBatch}
          accent
        />
      )}
    </Card>
  );
}
