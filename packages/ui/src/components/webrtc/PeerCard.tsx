import type { ReactNode } from "react";

import { LatencyChip } from "./LatencyChip";
import { QualityIndicator } from "./QualityIndicator";
import { Badge } from "../core/Badge";
import { StatusDot, type Status } from "../core/StatusDot";
import { Sparkline } from "../data/Sparkline";
import { cn } from "../../lib/cn";

export interface PeerCardProps {
  /** The raw identifier, never prettified: `ff104b2c`. */
  peerId: ReactNode;
  status?: Status;
  /** 0–100 quality score, drives the bar indicator. */
  score?: number;
  /** Round-trip time in ms. */
  rtt?: number;
  /** Jitter in ms. */
  jitter?: number;
  /** Packet loss as a percentage. */
  loss?: number;
  codec?: ReactNode;
  tracks?: string[];
  region?: ReactNode;
  /** RTT history for the sparkline. */
  samples?: number[];
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function PeerCard({
  peerId,
  status = "connected",
  score,
  rtt,
  jitter,
  loss,
  codec,
  tracks = [],
  region,
  samples,
  selected = false,
  onClick,
  className,
}: PeerCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-card border bg-card px-5 pb-5 pt-4",
        "transition-[box-shadow,border-color] duration-180 ease-out",
        onClick ? "cursor-pointer" : "cursor-default",
        selected
          ? "border-accent shadow-ring-accent"
          : "border-border shadow-sm hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <StatusDot status={status} />
          <span className="truncate text-14 font-medium text-strong">{peerId}</span>
          {region && <Badge tone="neutral">{region}</Badge>}
        </span>
        <QualityIndicator score={score} />
      </div>

      {samples && (
        <Sparkline
          data={samples}
          width={260}
          height={38}
          tone={score != null && score < 70 ? "warn" : "accent"}
          threshold={200}
          className="w-full"
        />
      )}

      <div className="flex flex-wrap gap-2">
        {rtt != null && <LatencyChip value={rtt} label="RTT" metric="rtt" />}
        {jitter != null && <LatencyChip value={jitter} label="Jitter" metric="jitter" />}
        {loss != null && <LatencyChip value={loss} label="Loss" metric="loss" unit="%" />}
      </div>

      {(codec || tracks.length > 0) && (
        <div className="flex gap-3 border-t border-border-subtle pt-3 text-12 text-muted">
          {codec && (
            <span>
              Codec <span className="text-strong">{codec}</span>
            </span>
          )}
          {tracks.length > 0 && (
            <span>
              Tracks <span className="text-strong">{tracks.join(", ")}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
