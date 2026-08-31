import { cn } from '../../lib/utils';

export type Status = "live" | "connecting" | "healthy" | "degraded" | "failed" | "idle";

const TONE: Record<Status, string> = {
  live: "bg-ok-solid",
  connecting: "bg-info-solid",
  healthy: "bg-ok-solid",
  degraded: "bg-warn-solid",
  failed: "bg-danger-solid",
  idle: "bg-idle",
};

/**
 * Status is a dot, never an icon and never an emoji.
 * The only loop in the system: a 2.6s breath on live / connecting.
 */
export function StatusDot({ status = "idle", className }: { status?: Status; className?: string }) {
  const breathes = status === "live" || status === "connecting";
  return (
    <span
      role="img"
      aria-label={status}
      className={cn("inline-block size-1.5 shrink-0 rounded-pill", TONE[status], breathes && "animate-[var(--animate-breathe)]", className)}
    />
  );
}
