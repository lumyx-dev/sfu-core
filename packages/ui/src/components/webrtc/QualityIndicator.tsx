import { cn } from "../../lib/cn";

export type QualityLevel = "excellent" | "good" | "degraded" | "poor" | "unknown";

const LEVELS: Record<
  QualityLevel,
  { bars: number; bar: string; text: string; label: string }
> = {
  excellent: { bars: 4, bar: "bg-ok", text: "text-ok", label: "Excellent" },
  good: { bars: 3, bar: "bg-accent", text: "text-accent", label: "Good" },
  degraded: { bars: 2, bar: "bg-warn", text: "text-warn", label: "Degraded" },
  poor: { bars: 1, bar: "bg-danger", text: "text-danger", label: "Poor" },
  unknown: { bars: 0, bar: "bg-idle", text: "text-idle", label: "Unknown" },
};

/** Score bands, matching the repo's quality scoring. */
function levelForScore(score: number): QualityLevel {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 40) return "degraded";
  return "poor";
}

export interface QualityIndicatorProps {
  level?: QualityLevel;
  /** 0–100. Takes precedence over `level`. */
  score?: number;
  /** Adds the word and the raw score beside the bars. */
  showLabel?: boolean;
  /** Height of the tallest bar in px. Default 14. */
  size?: number;
  className?: string;
}

export function QualityIndicator({
  level = "unknown",
  score,
  showLabel = false,
  size = 14,
  className,
}: QualityIndicatorProps) {
  const key = score != null ? levelForScore(score) : level;
  const tone = LEVELS[key];
  return (
    <span
      title={`Quality: ${tone.label}`}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span className="inline-flex items-end gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{ height: Math.round((size / 4) * i) }}
            className={cn(
              "w-[3px] rounded-sm",
              i <= tone.bars ? tone.bar : "bg-border",
            )}
          />
        ))}
      </span>
      {showLabel && <span className={cn("text-12", tone.text)}>{tone.label}</span>}
      {showLabel && score != null && (
        <span className="sl-num text-12 text-muted">{score}</span>
      )}
    </span>
  );
}
