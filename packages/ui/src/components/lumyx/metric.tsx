import * as React from "react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

export type MetricState = "ok" | "warn" | "danger" | "neutral";

const INK: Record<MetricState, string> = {
  ok: "text-strong",
  warn: "text-warn",
  danger: "text-danger",
  neutral: "text-strong",
};

/**
 * A coloured number always means a threshold was crossed — never decoration.
 * Label recedes (11px uppercase muted) so the value leads (34px).
 */
export function MetricCard({
  label, value, unit, state = "ok", threshold, series, seriesColor, className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  state?: MetricState;
  threshold?: string;
  series?: number[];
  seriesColor?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 bg-card p-5", className)}>
      <span className="sl-label">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={cn("sl-num text-34 font-semibold", INK[state])}>{value}</span>
        {unit ? <span className={cn("text-14 font-medium", state === "ok" || state === "neutral" ? "text-muted" : INK[state])}>{unit}</span> : null}
      </div>
      {series ? <Sparkline data={series} color={seriesColor ?? "var(--series-1)"} className="mt-1" /> : null}
      {threshold ? <span className="sl-num text-11 text-faint">{threshold}</span> : null}
    </div>
  );
}

/**
 * A 1px gap over --border-subtle: the cells' own white paints the hairlines,
 * so a group of metrics reads as one instrument.
 */
export function MetricGrid({ columns = 4, className, children }: { columns?: number; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("grid gap-px overflow-hidden rounded-lg border border-hairline bg-subtle shadow-[var(--shadow-sm)]", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
