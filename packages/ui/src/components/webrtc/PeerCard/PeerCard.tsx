import type { CSSProperties, MouseEventHandler } from 'react';
import { cn } from '../../../lib/cn';
import { Badge } from '../../core/Badge';
import { StatusDot, type StatusDotStatus } from '../../core/StatusDot';
import { Sparkline } from '../../data/Sparkline';
import { LatencyChip } from '../LatencyChip';
import { QualityIndicator } from '../QualityIndicator';
import s from './PeerCard.module.css';

export interface PeerCardProps {
  peerId?: string;
  status?: StatusDotStatus;
  score?: number;
  rtt?: number;
  jitter?: number;
  loss?: number;
  codec?: string;
  tracks?: string[];
  region?: string;
  samples?: number[];
  selected?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  style?: CSSProperties;
}

/* Source :2368-2478. Le useState(hover) source devient :hover en CSS ; selected devient une
   classe (le box-shadow "ring" de selected gagne toujours sur le hover — voir l'ordre des
   regles dans PeerCard.module.css). onClick est transmis tel quel, jamais consomme, donc pas
   de directive client cote composant (regle de conversion 7). Le tone du Sparkline (score<70 -> warn, sinon
   accent) et son threshold=200 sont recopies a l'identique ; RTT/Jitter/Loss passent par
   LatencyChip avec metric="rtt"/"jitter"/"loss" — la source n'expose PAS nack/freeze/bitrate
   sur PeerCard (cf. rapport). */
export function PeerCard({
  peerId,
  status = 'connected',
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
  style,
}: PeerCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(s.card, onClick && s.clickable, selected && s.selected)}
      style={style}
    >
      <div className={s.head}>
        <span className={s.identity}>
          <StatusDot status={status} />
          <span className={s.peerId}>{peerId}</span>
          {region && <Badge tone="neutral">{region}</Badge>}
        </span>
        <QualityIndicator score={score} />
      </div>

      {samples && (
        <Sparkline
          data={samples}
          width={260}
          height={38}
          tone={score != null && score < 70 ? 'warn' : 'accent'}
          threshold={200}
          style={{ width: '100%' }}
        />
      )}

      <div className={s.metrics}>
        {rtt != null && <LatencyChip value={rtt} label="RTT" metric="rtt" />}
        {jitter != null && <LatencyChip value={jitter} label="Jitter" metric="jitter" />}
        {loss != null && <LatencyChip value={loss} label="Loss" metric="loss" unit="%" />}
      </div>

      {(codec || tracks.length > 0) && (
        <div className={s.foot}>
          {codec && (
            <span>
              Codec <span className={s.footValue}>{codec}</span>
            </span>
          )}
          {tracks.length > 0 && (
            <span>
              Tracks <span className={s.footValue}>{tracks.join(', ')}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
