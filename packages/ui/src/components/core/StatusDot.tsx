import { cn } from "../../lib/cn";

export type Status =
  | "live"
  | "connected"
  | "connecting"
  | "degraded"
  | "disconnected"
  | "error"
  | "idle";

/**
 * Fill, halo and whether the dot breathes. `live` and `connecting` are the only
 * two states that animate — the single loop the system allows.
 */
const TONE: Record<Status, { dot: string; halo: string; breathing: boolean }> = {
  live: { dot: "bg-ok", halo: "ring-ok/16", breathing: true },
  connected: { dot: "bg-ok", halo: "ring-ok/16", breathing: false },
  connecting: { dot: "bg-warn", halo: "ring-warn/16", breathing: true },
  degraded: { dot: "bg-warn", halo: "ring-warn/16", breathing: false },
  disconnected: { dot: "bg-danger", halo: "ring-danger/16", breathing: false },
  error: { dot: "bg-danger", halo: "ring-danger/16", breathing: false },
  idle: { dot: "bg-idle", halo: "ring-idle/16", breathing: false },
};

export interface StatusDotProps {
  status?: Status;
  /** Diameter in px. Default 8. */
  size?: number;
  /** The 3px 16% ring around the dot. Off inside dense tables. */
  halo?: boolean;
  className?: string;
}

/** Status is a dot. Never an emoji, never a word where a dot will do. */
export function StatusDot({
  status = "idle",
  size = 8,
  halo = true,
  className,
}: StatusDotProps) {
  const tone = TONE[status];
  return (
    <span
      role="img"
      aria-label={status}
      style={{ width: size, height: size }}
      className={cn(
        "inline-block shrink-0 rounded-full transition-colors duration-180 ease-out",
        tone.dot,
        halo && ["ring-3", tone.halo],
        tone.breathing && "animate-breathe",
        className,
      )}
    />
  );
}
