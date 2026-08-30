import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './MetricCard.module.css';

export type MetricCardStatus = 'ok' | 'warn' | 'error';
export type MetricCardDeltaTone = 'up' | 'down' | 'flat';
export type MetricCardAlign = 'left' | 'right';

export interface MetricCardProps {
  label?: ReactNode;
  value?: ReactNode;
  unit?: ReactNode;
  delta?: ReactNode;
  deltaTone?: MetricCardDeltaTone;
  status?: MetricCardStatus;
  sublabel?: ReactNode;
  /* Slot ReactNode — vide dans cette tache, rempli par le Sparkline de la Task 9. */
  chart?: ReactNode;
  align?: MetricCardAlign;
  compact?: boolean;
  style?: CSSProperties;
}

/* Source :734-799. Le nombre principal porte sl-num — regle systeme (base.css) : tout
   nombre live est en chiffres tabulaires. status et deltaTone sont des enums fermes ->
   classes ; align et compact sont des props explicitement listees comme "prop-conditioned"
   -> classes egalement. */
export function MetricCard({
  label,
  value,
  unit,
  delta,
  deltaTone,
  status,
  sublabel,
  chart,
  align = 'left',
  compact = false,
  style,
}: MetricCardProps) {
  const right = align === 'right';
  return (
    <div className={cn(s.card, right && s.right, compact && s.compact)} style={style}>
      <span className="sl-label">{label}</span>
      <span className={cn('sl-num', s.valueRow, status && s[status])}>
        {value}
        {unit != null && <span className={s.unit}>{unit}</span>}
      </span>
      {(delta != null || sublabel) && (
        <span className={s.deltaRow}>
          {delta != null && (
            <span className={cn('sl-num', s.delta, deltaTone && s[deltaTone])}>{delta}</span>
          )}
          {sublabel && <span className={s.sublabel}>{sublabel}</span>}
        </span>
      )}
      {chart && <span className={s.chartSlot}>{chart}</span>}
    </div>
  );
}
