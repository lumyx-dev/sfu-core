import type { ReactNode } from "react";

import { Icon } from "../core/Icon";
import { StatusDot, type Status } from "../core/StatusDot";
import { cn } from "../../lib/cn";

export interface VideoTileProps {
  /** Peer id or display name, shown in the bottom-left capsule. */
  label?: ReactNode;
  /** Trailing detail in the capsule, usually a latency. Rendered tabular. */
  sublabel?: ReactNode;
  status?: Status;
  /** No stream: shows the camera-off glyph instead of `children`. */
  empty?: boolean;
  emptyText?: ReactNode;
  /** Top-right capsule, usually a `<QualityIndicator />`. */
  overlay?: ReactNode;
  /** The `<video>` element. */
  children?: ReactNode;
  /** CSS aspect ratio. The house default is 16/10. */
  ratio?: string;
  className?: string;
}

/**
 * The only imagery in the product is live video. 18px radius, `object-fit:
 * cover`, one floating capsule bottom-left and one top-right.
 *
 * The capsule is one of exactly two places the system uses blur — it has to
 * survive any frame underneath it.
 */
export function VideoTile({
  label,
  sublabel,
  status = "live",
  empty = false,
  emptyText = "No stream",
  overlay,
  children,
  ratio = "16/10",
  className,
}: VideoTileProps) {
  return (
    <div
      style={{ aspectRatio: ratio }}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-card border border-border bg-inset shadow-xs",
        className,
      )}
    >
      {!empty && children}
      {empty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-12 text-faint">
          <Icon name="video-off" size={24} />
          {emptyText}
        </div>
      )}
      {(label || sublabel) && (
        <span className="absolute inset-x-3 bottom-3 flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "inline-flex min-w-0 items-center gap-2 rounded-full px-2.5 py-1 text-12",
              empty
                ? "border border-border bg-card text-body"
                : "bg-overlay text-on-overlay backdrop-blur-overlay",
            )}
          >
            <StatusDot status={empty ? "idle" : status} size={6} halo={false} />
            <span className="truncate">{label}</span>
            {sublabel && <span className="sl-num opacity-[0.72]">{sublabel}</span>}
          </span>
        </span>
      )}
      {overlay && (
        <span className="absolute right-3 top-3 inline-flex items-center rounded-full border border-border bg-card px-2.5 py-[5px] shadow-xs">
          {overlay}
        </span>
      )}
    </div>
  );
}
