import { VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot, type Status } from "./status-dot";
import { QualityIndicator, type Quality } from "./quality";

/**
 * 16:10, object-fit cover, 18px radius. One capsule bottom-left (dot + peer id +
 * latency), one quality capsule top-right. Empty shows a camera-off glyph and "No stream".
 */
export function VideoTile({
  peerId, latencyMs, status = "live", quality = "good", src, className,
}: {
  peerId: string; latencyMs?: number; status?: Status; quality?: Quality; src?: string; className?: string;
}) {
  return (
    <div className={cn("relative aspect-[16/10] overflow-hidden rounded-lg border border-hairline bg-[var(--n-900)]", className)}>
      {src ? (
        <video src={src} muted autoPlay playsInline className="size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 text-[var(--n-500)]">
          <VideoOff className="size-6 stroke-[1.75]" />
          <span className="text-12">No stream</span>
        </div>
      )}
      <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-pill bg-[var(--surface-overlay)] px-2.5 py-1 text-11 text-white backdrop-blur-[6px]">
        <StatusDot status={status} />
        <span className="sl-num">{peerId}</span>
        {latencyMs != null ? <span className="sl-num opacity-70">{latencyMs}ms</span> : null}
      </span>
      <span className="absolute right-3 top-3 rounded-pill bg-[var(--surface-overlay)] px-2 py-1 backdrop-blur-[6px]">
        <QualityIndicator quality={quality} />
      </span>
    </div>
  );
}
