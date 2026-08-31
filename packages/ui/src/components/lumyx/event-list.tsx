import { cn } from "@/lib/utils";
import { StatusDot, type Status } from "./status-dot";

export type LumyxEvent = { time: string; message: string; detail?: string; status?: Status };

/** Events are completed facts, Sentence case, identifier as trailing detail. */
export function EventList({ events, className }: { events: LumyxEvent[]; className?: string }) {
  return (
    <ul className={cn("sl-scroll flex flex-col divide-y divide-[var(--border-subtle)] overflow-y-auto", className)}>
      {events.map((e, i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-2.5">
          <StatusDot status={e.status ?? "idle"} />
          <span className="text-13 text-body">{e.message}</span>
          {e.detail ? <span className="sl-num text-12 text-faint">· {e.detail}</span> : null}
          <span className="sl-num ml-auto text-12 text-faint">{e.time}</span>
        </li>
      ))}
    </ul>
  );
}
