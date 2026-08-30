import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './ProgressBar.module.css';

export type ProgressBarTone = 'accent' | 'secondary' | 'ok' | 'warn' | 'danger';

export interface ProgressBarProps {
  value?: number;
  max?: number;
  label?: ReactNode;
  showValue?: boolean;
  unit?: string;
  tone?: ProgressBarTone;
  height?: number;
  threshold?: number;
  indeterminate?: boolean;
  style?: CSSProperties;
}

/* Source :845-914. value/max/height/threshold sont des valeurs runtime -> inline
   (regle §5). tone est un enum ferme -> classe. indeterminate -> classe qui joue
   sl-shimmer (deja definie dans motion.css, referencee sans redeclaration). Le
   franchissement du threshold ne change PAS la couleur de la barre dans la source —
   seul un repere (marker) de 2px est dessine a sa position ; ne pas ajouter de logique
   de couleur conditionnelle qui n'existe pas dans la source (divergence avec le brief,
   voir rapport). */
export function ProgressBar({
  value = 0,
  max = 100,
  label,
  showValue = false,
  unit = '%',
  tone = 'accent',
  height = 6,
  threshold,
  indeterminate = false,
  style,
}: ProgressBarProps) {
  const toneClass = s[tone] || s.accent;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={s.wrap} style={style}>
      {(label || showValue) && (
        <div className={s.head}>
          <span>{label}</span>
          {showValue && (
            <span className={cn('sl-num', s.value)}>
              {value}
              {unit}
            </span>
          )}
        </div>
      )}
      <div className={s.track} style={{ height }}>
        {indeterminate ? (
          <div className={cn(s.shimmer, toneClass)} />
        ) : (
          <div className={cn(s.fill, toneClass)} style={{ width: `${pct}%` }} />
        )}
        {threshold != null && !indeterminate && (
          <div
            className={s.threshold}
            style={{ left: `${Math.min(100, (threshold / max) * 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}
