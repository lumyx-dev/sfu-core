import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "secondary"
  | "ok"
  | "warn"
  | "danger"
  | "info";

const TONES: Record<BadgeTone, { tint: string; solid: string }> = {
  neutral: { tint: "bg-inset border-border text-body", solid: "bg-body" },
  accent: { tint: "bg-accent-tint border-accent-border text-accent-text", solid: "bg-accent" },
  secondary: { tint: "bg-accent-2-tint border-transparent text-accent-2", solid: "bg-accent-2" },
  ok: { tint: "bg-ok-tint border-transparent text-ok", solid: "bg-ok" },
  warn: { tint: "bg-warn-tint border-transparent text-warn", solid: "bg-warn" },
  danger: { tint: "bg-danger-tint border-transparent text-danger", solid: "bg-danger" },
  info: { tint: "bg-info-tint border-transparent text-info", solid: "bg-info" },
};

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** Micro-label casing — for a column of codes, not for prose. */
  uppercase?: boolean;
  /** Filled rather than tinted. Reserve for the one badge that must dominate. */
  solid?: boolean;
  className?: string;
}

export function Badge({
  children,
  tone = "neutral",
  uppercase = false,
  solid = false,
  className,
}: BadgeProps) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip border px-2 py-[3px] text-11 font-medium",
        uppercase ? "uppercase tracking-label" : "tracking-normal",
        solid ? cn(t.solid, "border-transparent text-on-accent") : t.tint,
        className,
      )}
    >
      {children}
    </span>
  );
}
