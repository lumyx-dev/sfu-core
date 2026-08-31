"use client";

import { useId } from "react";

import { seriesColor, type SeriesTone } from "./series";
import { cn } from "../../lib/cn";

export interface SparklineProps {
  /** Oldest to newest. A single point renders a flat line. */
  data?: number[];
  width?: number;
  height?: number;
  tone?: SeriesTone;
  /** The 16%→0 fade under the line — the only gradient the system permits. */
  fill?: boolean;
  /** Draws a dashed danger rule and expands the domain to include it. */
  threshold?: number;
  strokeWidth?: number;
  /** Marks the latest value. */
  dot?: boolean;
  className?: string;
}

export function Sparkline({
  data = [],
  width = 120,
  height = 32,
  tone = "accent",
  fill = true,
  threshold,
  strokeWidth = 1.5,
  dot = true,
  className,
}: SparklineProps) {
  const color = seriesColor(tone);
  const points = data.length ? data : [0];
  const max = Math.max(...points, threshold ?? -Infinity);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const y = (v: number) => height - ((v - min) / span) * (height - 4) - 2;
  const line = points
    .map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(" ");
  const gradientId = `sp${useId().replace(/:/g, "")}`;
  const last = points[points.length - 1] ?? 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn("block overflow-visible", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {threshold != null && (
        <line
          x1="0"
          y1={y(threshold)}
          x2={width}
          y2={y(threshold)}
          stroke="var(--sl-danger)"
          strokeWidth="1"
          strokeDasharray="3 4"
          opacity="0.45"
        />
      )}
      {fill && (
        <path
          d={`${line} L${width} ${height} L0 ${height} Z`}
          fill={`url(#${gradientId})`}
        />
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {dot && (
        <circle cx={(points.length - 1) * step} cy={y(last)} r="2" fill={color} />
      )}
    </svg>
  );
}
