import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

/**
 * Thresholds from the repo README's metrics reference: `[breached, approaching]`.
 * Amber at roughly half the danger value, danger at or above it.
 */
const THRESHOLDS = {
  rtt: [200, 120],
  jitter: [30, 15],
  loss: [2, 0.5],
  nack: [5, 2],
  freeze: [1, 0.3],
} as const satisfies Record<string, readonly [number, number]>;

export type LatencyMetric = keyof typeof THRESHOLDS;

const TONES = {
  ok: { chip: "border-border bg-transparent text-strong", plain: "text-strong" },
  warn: { chip: "border-transparent bg-warn-tint text-warn", plain: "text-warn" },
  danger: { chip: "border-transparent bg-danger-tint text-danger", plain: "text-danger" },
} as const;

export interface LatencyChipProps {
  value: number;
  unit?: ReactNode;
  /** Picks the threshold pair. Default `rtt`. */
  metric?: LatencyMetric;
  /** Quiet prefix inside the chip, e.g. "RTT". */
  label?: ReactNode;
  /** Bare coloured number with no chrome — for dense table cells. */
  plain?: boolean;
  className?: string;
}

export function LatencyChip({
  value,
  unit = "ms",
  metric = "rtt",
  label,
  plain = false,
  className,
}: LatencyChipProps) {
  const [bad, warn] = THRESHOLDS[metric];
  const tone = TONES[value >= bad ? "danger" : value >= warn ? "warn" : "ok"];

  if (plain) {
    return (
      <span className={cn("sl-num", tone.plain, className)}>
        {value}
        {unit}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip border px-2 py-[3px] text-12",
        tone.chip,
        className,
      )}
    >
      {label && <span className="text-muted">{label}</span>}
      <span className="sl-num">
        {value}
        {unit}
      </span>
    </span>
  );
}
