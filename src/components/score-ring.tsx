"use client";

import { motion } from "framer-motion";

/**
 * Score gauge estilo cluster digital: anillo segmentado (guiones) que se
 * completa según el score. Verde alto, ámbar medio, gris bajo.
 */
export function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const stroke = size >= 48 ? 4 : 3;
  const r = (size - stroke) / 2;
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
          strokeDasharray="2.6 2.2"
          pathLength={100}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray="2.6 2.2"
          pathLength={100}
          initial={{ strokeDashoffset: 0, opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            strokeDasharray: "2.6 2.2",
            clipPath: `inset(0 0 0 0)`,
          }}
          strokeDashoffset={0}
          mask={`url(#score-mask-${size})`}
        />
        <mask id={`score-mask-${size}`}>
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="white"
            strokeWidth={stroke + 2}
            pathLength={100}
            strokeDasharray={100}
            initial={{ strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: 100 - score }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </mask>
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
