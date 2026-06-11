"use client";

import { cn } from "@/lib/utils";

type Tone = "accent" | "success" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
};

/**
 * Gauge segmentado estilo tacómetro: bloques que se encienden en secuencia.
 * `redline`: cantidad de bloques finales marcados como zona crítica.
 */
export function SegmentGauge({
  ratio,
  segments = 10,
  tone = "accent",
  redline = 0,
  className,
  size = "md",
}: {
  ratio: number;
  segments?: number;
  tone?: Tone;
  redline?: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const clamped = Math.max(0, Math.min(ratio, 1));
  const lit = Math.round(clamped * segments);
  const height = size === "sm" ? "h-1" : "h-1.5";

  return (
    <div className={cn("flex gap-[3px]", className)} role="meter" aria-valuenow={Math.round(clamped * 100)}>
      {Array.from({ length: segments }, (_, i) => {
        const isLit = i < lit;
        const inRedline = i >= segments - redline;
        return (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-[1px]",
              height,
              isLit ? "seg-on" : "",
              isLit
                ? inRedline
                  ? "bg-danger"
                  : TONES[tone]
                : inRedline
                  ? "bg-danger/20"
                  : "bg-line"
            )}
            style={isLit ? { animationDelay: `${i * 22}ms` } : undefined}
          />
        );
      })}
    </div>
  );
}
