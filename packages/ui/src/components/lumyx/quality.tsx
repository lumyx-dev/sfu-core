import { cn } from '../../lib/utils';

export type Quality = "excellent" | "good" | "degraded" | "poor";

const BARS: Record<Quality, number> = { excellent: 4, good: 3, degraded: 2, poor: 1 };
const COLOR: Record<Quality, string> = {
  excellent: "var(--ok-solid)",
  good: "var(--ok-solid)",
  degraded: "var(--warn-solid)",
  poor: "var(--danger-solid)",
};

/** Reads faster than an icon in a table cell. */
export function QualityIndicator({ quality, showLabel = false, className }: { quality: Quality; showLabel?: boolean; className?: string }) {
  const active = BARS[quality];
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={quality}>
      <span className="inline-flex items-end gap-0.5" aria-label={quality}>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-1 rounded-[1px]"
            style={{ height: 3 + i * 2, background: i <= active ? COLOR[quality] : "var(--n-200)" }}
          />
        ))}
      </span>
      {showLabel ? <span className="text-12 text-muted capitalize">{quality}</span> : null}
    </span>
  );
}

/** `plain` is the dense-table mode: the number alone, coloured only past threshold. */
export function LatencyChip({ ms, plain = false, className }: { ms: number; plain?: boolean; className?: string }) {
  const state = ms < 80 ? "ok" : ms < 150 ? "warn" : "danger";
  const ink = state === "ok" ? "text-muted" : state === "warn" ? "text-warn" : "text-danger";
  if (plain) return <span className={cn("sl-num text-13", ink, className)}>{ms}ms</span>;
  const tint = state === "ok" ? "bg-ok-tint text-ok" : state === "warn" ? "bg-warn-tint text-warn" : "bg-danger-tint text-danger";
  return <span className={cn("sl-num inline-flex items-center rounded-pill px-2 py-0.5 text-11 font-medium", tint, className)}>{ms}ms</span>;
}
