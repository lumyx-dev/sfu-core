"use client";

import * as React from "react";

/**
 * The landing's live instrument: a dual-series area chart that keeps drifting.
 * Values are synthetic — the shapes and thresholds are the real ones.
 */
const N = 60;
const W = 640;
const H = 130;
const TOP = 12;
const BOTTOM = 118;

function seed(base: number, amp: number) {
  return Array.from(
    { length: N },
    (_, i) => base + Math.sin(i / 3.1) * amp * 0.6 + Math.sin(i / 1.7) * amp * 0.25
  );
}

function toPath(values: number[], min: number, max: number) {
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const clamped = Math.max(min, Math.min(max, v));
      const y = BOTTOM - ((clamped - min) / (max - min)) * (BOTTOM - TOP);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export type LiveSample = { jitter: string; loss: string; lossTone: string };

export function useLiveSeries() {
  const [jitter, setJitter] = React.useState<number[]>(() => seed(22, 12));
  const [loss, setLoss] = React.useState<number[]>(() => seed(0.5, 0.6));

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setJitter((s) => [...s.slice(1), Math.max(6, s[s.length - 1] + (Math.random() - 0.5) * 9)]);
      setLoss((s) => [
        ...s.slice(1),
        Math.max(0, Math.min(3.2, s[s.length - 1] + (Math.random() - 0.5) * 0.5)),
      ]);
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  const lastJitter = jitter[jitter.length - 1];
  const lastLoss = loss[loss.length - 1];

  return {
    jitter,
    loss,
    sample: {
      jitter: `${lastJitter.toFixed(0)}ms`,
      loss: `${lastLoss.toFixed(2)}%`,
      // A coloured number always means a threshold was crossed.
      lossTone: lastLoss > 2 ? "var(--danger)" : lastLoss > 1 ? "var(--warn)" : "var(--text-strong)",
    } satisfies LiveSample,
  };
}

export function LiveChart({ jitter, loss }: { jitter: number[]; loss: number[] }) {
  const line = toPath(jitter, 0, 60);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      className="block min-h-[130px] w-full flex-1"
    >
      <defs>
        <linearGradient id="sl-live-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W} ${BOTTOM} L0 ${BOTTOM} Z`} fill="url(#sl-live-fade)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      <path d={toPath(loss, 0, 4)} fill="none" stroke="var(--accent-2)" strokeWidth={1.5} strokeDasharray="4 4" />
    </svg>
  );
}
