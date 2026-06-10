"use client";

import { motion } from "framer-motion";

/** Anillo de score animado. Color semántico: verde alto, ámbar medio, gris bajo. */
export function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const stroke = size >= 48 ? 4 : 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color =
    score >= 75 ? "var(--success)" : score >= 45 ? "var(--warn)" : "var(--muted)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * score) / 100 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <span
        className="numeric absolute inset-0 flex items-center justify-center font-semibold"
        style={{ fontSize: size / 3.2, color }}
      >
        {score}
      </span>
    </div>
  );
}
