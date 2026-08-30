import type { CSSProperties } from 'react';
import { cn } from '../../../lib/cn';
import s from './QualityIndicator.module.css';

export type QualityIndicatorLevel = 'excellent' | 'good' | 'degraded' | 'poor' | 'unknown';

export interface QualityIndicatorProps {
  level?: QualityIndicatorLevel;
  score?: number;
  showLabel?: boolean;
  size?: number;
  style?: CSSProperties;
}

/* Source :2310-2364. LEVELS mappe chaque niveau a [bars (0-4), couleur, libelle]. Le libelle
   passe par la table JS ci-dessous ; les 0-4 barres allumees et leur couleur passent par les
   classes CSS (nth-child selon le niveau), puisque level est un enum ferme -> classe (regle de
   conversion 4) — pas de couleur recalculee en JS. score, quand fourni, recalcule le niveau
   (>=90 excellent, >=70 good, >=40 degraded, sinon poor) et prend le pas sur level — logique
   recopiee a l'identique. */
const LABEL: Record<QualityIndicatorLevel, string> = {
  excellent: 'Excellent',
  good: 'Good',
  degraded: 'Degraded',
  poor: 'Poor',
  unknown: 'Unknown',
};

function resolveLevel(level: QualityIndicatorLevel, score?: number): QualityIndicatorLevel {
  if (score == null) return level;
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 40) return 'degraded';
  return 'poor';
}

export function QualityIndicator({
  level = 'unknown',
  score,
  showLabel = false,
  size = 14,
  style,
}: QualityIndicatorProps) {
  const key = resolveLevel(level, score);
  const label = LABEL[key];

  return (
    <span title={`Quality: ${label}`} className={cn(s.wrap, s[key])} style={style}>
      <span className={s.bars}>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={s.bar} style={{ height: Math.round((size / 4) * i) }} />
        ))}
      </span>
      {showLabel && <span className={s.label}>{label}</span>}
      {showLabel && score != null && <span className={cn('sl-num', s.score)}>{score}</span>}
    </span>
  );
}
