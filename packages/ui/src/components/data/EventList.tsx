"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "../../lib/cn";

export type EventType = "info" | "event" | "send" | "error" | "muted";

const CHANNEL: Record<EventType, string> = {
  info: "text-body",
  event: "text-ok",
  send: "text-warn",
  error: "text-danger",
  muted: "text-muted",
};

export interface EventEntry {
  id?: string | number;
  /** Pre-formatted clock, e.g. "14:06:41". Rendered tabular. */
  time: ReactNode;
  /**
   * A completed fact in Sentence case: "Peer joined", "ICE failed".
   * Never a terminal line, never an emoji.
   */
  message: ReactNode;
  /** Trailing machine context: a peer id, a signaling message name, a code. */
  detail?: ReactNode;
  type?: EventType;
}

export interface EventListProps {
  entries?: EventEntry[];
  /** Fixes the height in px and makes the list scroll. */
  height?: number;
  /** Pins to the newest entry as they arrive. */
  autoScroll?: boolean;
  dense?: boolean;
  className?: string;
}

export function EventList({
  entries = [],
  height,
  autoScroll = false,
  dense = false,
  className,
}: EventListProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  return (
    <div
      ref={ref}
      style={{ height }}
      className={cn(
        "sl-scroll",
        height ? "overflow-y-auto" : "overflow-y-visible",
        className,
      )}
    >
      {entries.map((e, i) => (
        <div
          key={e.id ?? i}
          className={cn(
            "grid grid-cols-[58px_1fr] items-baseline gap-3 px-5 text-12",
            dense ? "py-[7px]" : "py-2.5",
            i > 0 && "border-t border-border-subtle",
          )}
        >
          <span className="sl-num text-faint">{e.time}</span>
          <span className={cn("break-words", CHANNEL[e.type ?? "info"])}>
            {e.message}
            {e.detail && <span className="text-muted"> · {e.detail}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
