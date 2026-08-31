import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export type ProgressTone = "accent" | "secondary" | "ok" | "warn" | "danger";

const TONES: Record<ProgressTone, string> = {
  accent: "bg-accent",
  secondary: "bg-accent-2",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
};

export interface ProgressBarProps {
  value?: number;
  max?: number;
  label?: ReactNode;
  /** Prints `value` + `unit` on the right of the label row. */
  showValue?: boolean;
  unit?: ReactNode;
  tone?: ProgressTone;
  /** Track height in px. Default 6. */
  height?: number;
  /** A 2px danger mark on the track. */
  threshold?: number;
  /** Work of unknown duration — one slow neutral shimmer, no percentage. */
  indeterminate?: boolean;
  className?: string;
}

export function ProgressBar({
  value = 0,
  max = 100,
  label,
  showValue = false,
  unit = "%",
  tone = "accent",
  height = 6,
  threshold,
  indeterminate = false,
  className,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {(label || showValue) && (
        <div className="flex justify-between gap-2 text-12 text-muted">
          <span>{label}</span>
          {showValue && (
            <span className="sl-num text-strong">
              {value}
              {unit}
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={max}
        style={{ height }}
        className="relative overflow-hidden rounded-full bg-inset"
      >
        {indeterminate ? (
          <div
            className={cn(
              "absolute inset-0 w-[38%] animate-shimmer opacity-55",
              TONES[tone],
            )}
          />
        ) : (
          <div
            style={{ width: `${pct}%` }}
            className={cn(
              "h-full rounded-full transition-[width] duration-260 ease-out",
              TONES[tone],
            )}
          />
        )}
        {threshold != null && !indeterminate && (
          <div
            style={{ left: `${Math.min(100, (threshold / max) * 100)}%` }}
            className="absolute -top-px -bottom-px w-0.5 rounded-sm bg-danger"
          />
        )}
      </div>
    </div>
  );
}
