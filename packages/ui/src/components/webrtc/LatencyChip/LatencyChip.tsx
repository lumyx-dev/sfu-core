import type { CSSProperties } from 'react';
import { cn } from '../../../lib/cn';
import s from './LatencyChip.module.css';

export type LatencyChipMetric = 'rtt' | 'jitter' | 'loss' | 'nack' | 'freeze';

export interface LatencyChipProps {
  value: number;
  unit?: string;
  metric?: LatencyChipMetric | (string & {});
  label?: string;
  plain?: boolean;
  style?: CSSProperties;
}

/* Source :2245-2308. THRESHOLDS n'a que 5 cles — rtt/jitter/loss/nack/freeze, chacune
   [bad, warn] — malgre les 6 metriques (rtt_ms, jitter_ms, packet_loss_ratio, nack_ratio,
   freeze_ratio, bitrate_kbps) citees comme "seuils reels du repo" dans le brief. Il n'existe
   pas de cle 'bitrate' : la regle systeme "un chiffre colore = un seuil franchi" ne couvre
   que ces 5 metriques ici, pas bitrate_kbps<100 (cf. rapport, divergence). Un metric non
   reconnu (dont 'bitrate') retombe sur THRESHOLDS.rtt via `|| THRESHOLDS.rtt` — recopie a
   l'identique, ne pas ajouter de seuil bitrate invente. */
const THRESHOLDS: Record<string, [number, number]> = {
  rtt: [200, 120],
  jitter: [30, 15],
  loss: [2, 0.5],
  nack: [5, 2],
  freeze: [1, 0.3],
};

type Key = 'ok' | 'warn' | 'danger';

export function LatencyChip({
  value,
  unit = 'ms',
  metric = 'rtt',
  label,
  plain = false,
  style,
}: LatencyChipProps) {
  const [bad, warn] = THRESHOLDS[metric] || THRESHOLDS.rtt;
  const key: Key = value >= bad ? 'danger' : value >= warn ? 'warn' : 'ok';

  if (plain) {
    return (
      <span className={cn('sl-num', s.plain, s[key])} style={style}>
        {value}
        {unit}
      </span>
    );
  }

  return (
    <span className={cn(s.chip, s[key])} style={style}>
      {label && <span className={s.label}>{label}</span>}
      <span className="sl-num">
        {value}
        {unit}
      </span>
    </span>
  );
}
