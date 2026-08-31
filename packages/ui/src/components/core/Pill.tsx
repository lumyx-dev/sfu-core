import type { ReactNode } from "react";

import { StatusDot, type Status } from "./StatusDot";
import { cn } from "../../lib/cn";

export type PillTone = "neutral" | "accent" | "secondary" | "muted";

const TONES: Record<PillTone, string> = {
  neutral: "text-body",
  accent: "text-accent-text",
  secondary: "text-accent-2",
  muted: "text-muted",
};

export interface PillProps {
  children: ReactNode;
  /** Renders a leading StatusDot. */
  status?: Status;
  /** Trailing count capsule. `0` still renders — only `undefined` hides it. */
  count?: number;
  tone?: PillTone;
  className?: string;
}

/** A capsule for a filter, a scope, or a live counter in the status strip. */
export function Pill({
  children,
  status,
  count,
  tone = "neutral",
  className,
}: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-3 py-[5px] text-12 shadow-xs",
        TONES[tone],
        className,
      )}
    >
      {status && <StatusDot status={status} />}
      {children}
      {count != null && (
        <span className="sl-num rounded-full bg-inset px-[7px] py-px text-11 text-muted">
          {count}
        </span>
      )}
    </span>
  );
}
