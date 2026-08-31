import { cn } from '../../lib/utils';
import { StatusDot, type Status } from "./status-dot";
import { QualityIndicator, LatencyChip, type Quality } from "./quality";

export type Peer = {
  id: string;
  name?: string;
  status: Status;
  rttMs: number;
  lossPct: number;
  jitterMs: number;
  quality: Quality;
  tracks?: string[];
};

/** Peers are indigo. Rooms and sessions are coral. They are never blended. */
export function PeerCard({ peer, className }: { peer: Peer; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-hairline bg-card p-4 shadow-[var(--shadow-sm)] transition-shadow duration-[180ms] hover:shadow-[var(--shadow-md)]", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusDot status={peer.status} />
          <span className="sl-num text-13 font-medium text-strong">{peer.id}</span>
        </div>
        <QualityIndicator quality={peer.quality} />
      </div>
      {peer.name ? <p className="mt-1 text-12 text-muted">{peer.name}</p> : null}
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          ["Rtt", `${peer.rttMs}ms`],
          ["Loss", `${peer.lossPct.toFixed(2)}%`],
          ["Jitter", `${peer.jitterMs}ms`],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1">
            <dt className="sl-label">{k}</dt>
            <dd className="sl-num text-14 font-medium text-strong">{v}</dd>
          </div>
        ))}
      </dl>
      {peer.tracks?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-subtle pt-3">
          {peer.tracks.map((t) => (
            <span key={t} className="rounded-xs bg-inset px-1.5 py-0.5 text-11 text-muted">{t}</span>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex justify-end">
        <LatencyChip ms={peer.rttMs} />
      </div>
    </div>
  );
}
