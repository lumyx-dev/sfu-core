import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export type MetricStatus = "ok" | "warn" | "error";
export type DeltaTone = "up" | "down" | "flat";

const STATUS: Record<MetricStatus, { value: string; unit: string }> = {
  ok: { value: "text-ok", unit: "text-ok" },
  warn: { value: "text-warn", unit: "text-warn" },
  error: { value: "text-danger", unit: "text-danger" },
};

const DELTA: Record<DeltaTone, string> = {
  up: "text-ok",
  down: "text-danger",
  flat: "text-muted",
};

export interface MetricCardProps {
  /** Sentence-case name, rendered as the 11px micro-label: "Packet loss". */
  label: ReactNode;
  /** Pre-formatted. Locale-group counts; keep two decimals on small percentages. */
  value: ReactNode;
  /** Always carry the unit: "ms", "%", "Mbps". Never round to look tidy. */
  unit?: ReactNode;
  /** Pre-formatted change, e.g. "+12%". */
  delta?: ReactNode;
  deltaTone?: DeltaTone;
  /**
   * Colours the value. Set it only when a threshold was actually crossed —
   * a coloured number is a signal, never decoration.
   */
  status?: MetricStatus;
  sublabel?: ReactNode;
  /** A `<Sparkline />` under the value. */
  chart?: ReactNode;
  align?: "left" | "right";
  /** 20px value instead of 34px, for a dense rail or a table cell. */
  compact?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  delta,
  deltaTone = "flat",
  status,
  sublabel,
  chart,
  align = "left",
  compact = false,
  className,
}: MetricCardProps) {
  const tone = status ? STATUS[status] : undefined;
  const right = align === "right";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 bg-card px-5 py-4",
        right ? "text-right" : "text-left",
        className,
      )}
    >
      <span className="sl-label">{label}</span>
      <span
        className={cn(
          "sl-num flex items-baseline gap-[3px] font-medium leading-flat tracking-display",
          right ? "justify-end" : "justify-start",
          compact ? "text-20" : "text-34",
          tone?.value ?? "text-strong",
        )}
      >
        {value}
        {unit && (
          <span
            className={cn(
              "font-normal",
              compact ? "text-12" : "text-14",
              tone?.unit ?? "text-muted",
            )}
          >
            {unit}
          </span>
        )}
      </span>
      {(delta != null || sublabel) && (
        <span
          className={cn(
            "flex items-center gap-2 text-12",
            right ? "justify-end" : "justify-start",
          )}
        >
          {delta != null && (
            <span className={cn("sl-num", DELTA[deltaTone])}>{delta}</span>
          )}
          {sublabel && <span className="text-muted">{sublabel}</span>}
        </span>
      )}
      {chart && <span className="mt-1">{chart}</span>}
    </div>
  );
}
