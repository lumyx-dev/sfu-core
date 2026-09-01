"use client";
import * as React from "react";
import { cn } from '../../lib/utils';

export type Series = { name: string; color: string; data: number[] };

/**
 * Dependency-free line chart on the five fixed series values.
 * Numbers change when their data changes — they are not tweened.
 */
export function TimeSeriesChart({
  series, height = 200, yUnit = "", xLabels = [], className,
}: { series: Series[]; height?: number; yUnit?: string; xLabels?: string[]; className?: string }) {
  const W = 800;
  const H = height;
  const padL = 40, padB = 22, padT = 8, padR = 8;
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all, 1);
  const min = 0;
  const len = Math.max(...series.map((s) => s.data.length), 2);
  const x = (i: number) => padL + (i / (len - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + t * (max - min));

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border-subtle)" strokeWidth="1" />
            <text x={0} y={y(t) + 3} fontSize="10" fill="var(--text-faint)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {Math.round(t)}{yUnit}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          return <polyline key={s.name} points={pts} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />;
        })}
        {xLabels.map((l, i) => (
          <text key={l + i} x={x((i / Math.max(xLabels.length - 1, 1)) * (len - 1))} y={H - 4} fontSize="10" fill="var(--text-faint)" textAnchor="middle">
            {l}
          </text>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-12 text-muted">
            <span className="h-0.5 w-3 rounded-pill" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
