import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { Badge } from '../../core/Badge';
import { StatusDot, type StatusDotStatus } from '../../core/StatusDot';
import { Sparkline } from '../../data/Sparkline';
import s from './RoomCard.module.css';

export type RoomCardHealth = 'ok' | 'degraded' | 'error' | 'idle';

export interface RoomCardProps {
  roomId?: string;
  peers?: number;
  uptime?: ReactNode;
  bitrate?: ReactNode;
  health?: RoomCardHealth;
  samples?: number[];
  region?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  style?: CSSProperties;
}

/* Source :2482-2583. useState(hover) -> :hover en CSS ; onClick transmis tel quel, donc pas de
   directive client cote composant (regle 7). health -> dot via une table fermee (ok->live, degraded->degraded,
   error->error, idle->idle, defaut live) recopiee a l'identique. Le Sparkline prend
   tone="secondary" fixe, sans threshold (contrairement a PeerCard) — la source ne colore RIEN
   ici en fonction d'un seuil : peers/uptime/bitrate restent en --text-strong quel que soit
   health, "degraded" ne change que le StatusDot (cf. rapport, la regle "chiffre colore =
   seuil franchi" ne s'applique pas a RoomCard). */
const DOT: Record<string, StatusDotStatus> = {
  ok: 'live',
  degraded: 'degraded',
  error: 'error',
  idle: 'idle',
};

export function RoomCard({
  roomId,
  peers = 0,
  uptime,
  bitrate,
  health = 'ok',
  samples,
  region,
  onClick,
  style,
}: RoomCardProps) {
  const dot = DOT[health] || 'live';

  return (
    <div onClick={onClick} className={cn(s.card, onClick && s.clickable)} style={style}>
      <div className={s.head}>
        <span className={s.identity}>
          <StatusDot status={dot} />
          <span className={s.roomId}>{roomId}</span>
        </span>
        {region && <Badge tone="secondary">{region}</Badge>}
      </div>

      {samples && (
        <Sparkline data={samples} width={260} height={34} tone="secondary" style={{ width: '100%' }} />
      )}

      <div className={s.stats}>
        {(
          [
            ['Peers', peers],
            ['Uptime', uptime ?? '—'],
            ['Bitrate', bitrate ?? '—'],
          ] as Array<[string, ReactNode]>
        ).map(([k, v]) => (
          <span key={k} className={s.stat}>
            <span className={cn('sl-num', s.statValue)}>{v}</span>
            <span className="sl-label">{k}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
