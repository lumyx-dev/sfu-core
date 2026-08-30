import type { CSSProperties } from 'react';
import s from './LoadingSkeleton.module.css';

export type LoadingSkeletonVariant = 'rows' | 'metric' | 'chart' | 'tile';

/* Bar — sous-composant interne, non exporte (source :1433-1458). Largeur/hauteur/radius sont
   des valeurs runtime (index de boucle, colonnes) donc restent inline ; le shimmer statique
   (overlay + animation) est en CSS, reference sl-shimmer defini dans motion.css. */
interface BarProps {
  width: string;
  height: string;
  radius?: string;
  style?: CSSProperties;
}

function Bar({ width, height, radius = 'var(--radius-pill)', style }: BarProps) {
  return (
    <span className={s.bar} style={{ width, height, borderRadius: radius, ...style }}>
      <span className={s.shimmer} />
    </span>
  );
}

export interface LoadingSkeletonProps {
  variant?: LoadingSkeletonVariant;
  rows?: number;
  columns?: number;
  style?: CSSProperties;
}

export function LoadingSkeleton({ variant = 'rows', rows = 4, columns = 4, style }: LoadingSkeletonProps) {
  if (variant === 'metric') {
    return (
      <div
        className={s.metricGrid}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, ...style }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className={s.metricCell}>
            <Bar width="52px" height="8px" />
            <Bar width="74px" height="22px" radius="var(--radius-xs)" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className={s.chartRow} style={style}>
        {Array.from({ length: 28 }).map((_, i) => (
          <Bar key={i} width="100%" height={`${(26 + (i * 41) % 66)}%`} radius="var(--radius-xs)" />
        ))}
      </div>
    );
  }

  if (variant === 'tile') {
    return (
      <div className={s.tile} style={style}>
        <Bar width="100%" height="100%" radius="0" />
      </div>
    );
  }

  return (
    <div className={s.rowsWrap} style={style}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={s.row}>
          <Bar width="8px" height="8px" radius="50%" style={{ flex: '0 0 auto' }} />
          <Bar width={`${(34 + (i * 23) % 44)}%`} height="10px" />
          <Bar width="56px" height="10px" style={{ marginLeft: 'auto', flex: '0 0 auto' }} />
        </div>
      ))}
    </div>
  );
}
