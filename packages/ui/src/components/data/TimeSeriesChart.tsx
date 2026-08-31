"use client";

import { useId, type ReactNode } from "react";

import { seriesColor, type SeriesTone } from "./series";
import { cn } from "../../lib/cn";

export interface ChartSeries {
  name: string;
  /** Oldest to newest, aligned to `labels`. */
  data: number[];
  tone?: SeriesTone;
  /** Off to draw the line without its 14%→0 fade. */
  fill?: boolean;
}

export interface TimeSeriesChartProps {
  series?: ChartSeries[];
  /** X-axis ticks, spread evenly under the plot. */
  labels?: string[];
  height?: number;
  /** Draws a dashed danger rule and widens the domain to include it. */
  threshold?: number;
  /** Sits on the right of the threshold rule, e.g. "2% budget". */
  thresholdLabel?: ReactNode;
  yTicks?: number;
  /** Appended to every y tick. */
  unit?: string;
  /** Playhead position, 0–100. Used by session replay. */
  cursor?: number;
  className?: string;
}

const VIEW_W = 1000;
/** Width of the y-tick gutter, so the x labels line up with the plot. */
const GUTTER = 34;

export function TimeSeriesChart({
  series = [],
  labels = [],
  height = 180,
  threshold,
  thresholdLabel,
  yTicks = 4,
  unit = "",
  cursor,
  className,
}: TimeSeriesChartProps) {
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all, threshold ?? -Infinity) * 1.08 || 1;
  const min = 0;
  const y = (v: number) => height - ((v - min) / (max - min || 1)) * height;
  const uid = useId().replace(/:/g, "");
  const ticks = Array.from(
    { length: yTicks + 1 },
    (_, i) => min + ((max - min) / yTicks) * i,
  );

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex min-w-0 gap-1.5">
        <div
          style={{ height }}
          className="flex flex-none flex-col justify-between pb-px"
        >
          {ticks
            .slice()
            .reverse()
            .map((t, i) => (
              <span key={i} className="sl-num text-11 leading-flat text-faint">
                {Math.round(t)}
                {unit}
              </span>
            ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${VIEW_W} ${height}`}
            width="100%"
            height={height}
            preserveAspectRatio="none"
            aria-hidden
            className="block overflow-visible"
          >
            <defs>
              {series.map((s, i) => (
                <linearGradient key={i} id={`ts${uid}${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={seriesColor(s.tone)} stopOpacity="0.14" />
                  <stop offset="100%" stopColor={seriesColor(s.tone)} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {ticks.map((t, i) => (
              <line
                key={i}
                x1="0"
                y1={y(t)}
                x2={VIEW_W}
                y2={y(t)}
                stroke="var(--sl-border-subtle)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {threshold != null && (
              <line
                x1="0"
                y1={y(threshold)}
                x2={VIEW_W}
                y2={y(threshold)}
                stroke="var(--sl-danger)"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.6"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {series.map((s, i) => {
              const step = s.data.length > 1 ? VIEW_W / (s.data.length - 1) : VIEW_W;
              const line = s.data
                .map((v, k) => `${k ? "L" : "M"}${(k * step).toFixed(1)} ${y(v).toFixed(1)}`)
                .join(" ");
              const color = seriesColor(s.tone);
              return (
                <g key={i}>
                  {s.fill !== false && (
                    <path
                      d={`${line} L${VIEW_W} ${height} L0 ${height} Z`}
                      fill={`url(#ts${uid}${i})`}
                    />
                  )}
                  <path
                    d={line}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </svg>
          {cursor != null && (
            <div
              style={{ left: `${cursor}%` }}
              className="absolute -top-1 -bottom-1 w-px bg-accent"
            />
          )}
          {threshold != null && thresholdLabel && (
            <span
              style={{ top: y(threshold) - 16 }}
              className="absolute right-0 bg-card px-1 text-11 text-danger"
            >
              {thresholdLabel}
            </span>
          )}
        </div>
      </div>
      <div style={{ paddingLeft: GUTTER }} className="flex justify-between">
        {labels.map((l) => (
          <span key={l} className="sl-num text-11 text-faint">
            {l}
          </span>
        ))}
      </div>
      {series.length > 1 && (
        <div style={{ paddingLeft: GUTTER }} className="flex flex-wrap gap-4">
          {series.map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 text-12 text-muted"
            >
              <span
                style={{ background: seriesColor(s.tone) }}
                className="h-0.5 w-2.5 rounded-sm"
              />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
