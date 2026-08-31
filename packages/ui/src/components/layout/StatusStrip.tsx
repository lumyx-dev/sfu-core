import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface StatusStripItem {
  label: ReactNode;
  /** Pre-formatted with its unit. Rendered tabular. */
  value: ReactNode;
  /** Colour the value only when a threshold was actually crossed. */
  tone?: "default" | "warn" | "danger";
}

export interface StatusStripProps {
  /** Free-form context on the left: connection state, region, last update. */
  left?: ReactNode;
  /** Live counters, right-aligned. */
  items?: StatusStripItem[];
  className?: string;
}

const TONES = {
  default: "text-strong",
  warn: "text-warn",
  danger: "text-danger",
} as const;

export function StatusStrip({ left, items = [], className }: StatusStripProps) {
  return (
    <footer
      className={cn(
        "flex items-center justify-between gap-4 border-t border-border bg-card px-6 py-3 text-12 text-muted",
        className,
      )}
    >
      <span className="min-w-0 truncate">{left}</span>
      <span className="flex flex-none gap-5">
        {items.map((it, i) => (
          <span key={i} className="inline-flex gap-1.5">
            <span>{it.label}</span>
            <span className={cn("sl-num", TONES[it.tone ?? "default"])}>
              {it.value}
            </span>
          </span>
        ))}
      </span>
    </footer>
  );
}
