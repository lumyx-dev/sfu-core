import type { ReactNode } from "react";

import { Badge } from "../core/Badge";
import { StatusDot, type Status } from "../core/StatusDot";
import { Sparkline } from "../data/Sparkline";
import { cn } from "../../lib/cn";

export type RoomHealth = "ok" | "degraded" | "error" | "idle";

const HEALTH_DOT: Record<RoomHealth, Status> = {
  ok: "live",
  degraded: "degraded",
  error: "error",
  idle: "idle",
};

export interface RoomCardProps {
  /** The raw room name, never prettified: `test-room`. */
  roomId: ReactNode;
  peers?: number;
  /** Pre-formatted, e.g. "18m 04s". */
  uptime?: ReactNode;
  /** Pre-formatted with its unit, e.g. "2.4 Mbps". */
  bitrate?: ReactNode;
  health?: RoomHealth;
  /** Bitrate history for the sparkline. Coral — this is the room axis. */
  samples?: number[];
  region?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function RoomCard({
  roomId,
  peers = 0,
  uptime,
  bitrate,
  health = "ok",
  samples,
  region,
  onClick,
  className,
}: RoomCardProps) {
  const stats: Array<[string, ReactNode]> = [
    ["Peers", peers],
    ["Uptime", uptime ?? "—"],
    ["Bitrate", bitrate ?? "—"],
  ];
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-card border border-border bg-card px-5 pb-5 pt-4 shadow-sm",
        "transition-shadow duration-180 ease-out hover:shadow-md",
        onClick ? "cursor-pointer" : "cursor-default",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <StatusDot status={HEALTH_DOT[health]} />
          <span className="truncate text-16 font-semibold text-strong">{roomId}</span>
        </span>
        {region && <Badge tone="secondary">{region}</Badge>}
      </div>

      {samples && (
        <Sparkline
          data={samples}
          width={260}
          height={34}
          tone="secondary"
          className="w-full"
        />
      )}

      <div className="grid grid-cols-3 gap-3">
        {stats.map(([k, v]) => (
          <span key={k} className="flex min-w-0 flex-col gap-0.5">
            <span className="sl-num truncate text-20 font-medium leading-flat text-strong">
              {v}
            </span>
            <span className="sl-label">{k}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
