import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusDot, type Status } from "./status-dot";
import { Badge } from "@/components/ui/badge";

export type Room = {
  id: string;
  region: string;
  peers: number;
  status: Status;
  durationLabel: string;
  bitrateLabel: string;
  worstLossPct: number;
};

export function RoomCard({ room, href, className }: { room: Room; href?: string; className?: string }) {
  const body = (
    <div className={cn("rounded-lg border border-hairline bg-card p-5 shadow-[var(--shadow-sm)] transition-shadow duration-[180ms] hover:shadow-[var(--shadow-md)]", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            <StatusDot status={room.status} />
            <span className="text-14 font-semibold text-strong">{room.id}</span>
          </span>
          <span className="sl-num text-12 text-muted">{room.region} · {room.durationLabel}</span>
        </div>
        <Badge tone="room">{room.peers} peers</Badge>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-subtle pt-4">
        <div className="flex flex-col gap-1">
          <span className="sl-label">Bitrate</span>
          <span className="sl-num text-14 font-medium text-strong">{room.bitrateLabel}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="sl-label">Worst loss</span>
          <span className={cn("sl-num text-14 font-medium", room.worstLossPct >= 2 ? "text-danger" : "text-strong")}>
            {room.worstLossPct.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block no-underline hover:no-underline">{body}</Link> : body;
}
