import { useId } from 'react';
import type { CSSProperties } from 'react';
import s from './Sparkline.module.css';

export type SparklineTone = 'accent' | 'secondary' | 'warn' | 'neutral' | 'ok' | 'danger';

export interface SparklineProps {
  data?: number[];
  width?: number;
  height?: number;
  tone?: SparklineTone;
  fill?: boolean;
  threshold?: number;
  strokeWidth?: number;
  dot?: boolean;
  style?: CSSProperties;
}

/* Source :930-1012. TONES mappe accent/secondary/warn/neutral/ok vers --series-1..5
   (dans cet ordre) et danger vers --danger — pas de correspondance directe tone->
   --accent/--ok/--warn/--danger comme le brief le laissait entendre pour 5 des 6
   entrees ; seul "danger" retombe sur le token semantique (cf. rapport, divergence).
   Tout le calcul de projection (min/max/span/step/y/d) est recopie a l'identique :
   ne pas reordonner les operations. Le degrade sous la courbe va de stopOpacity
   0.16 (haut) a 0 (bas) — valeur exacte de la source, ne pas arrondir a 0.15. */
const TONES: Record<string, string> = {
  accent: 'var(--series-1)',
  secondary: 'var(--series-2)',
  warn: 'var(--series-3)',
  neutral: 'var(--series-4)',
  ok: 'var(--series-5)',
  danger: 'var(--danger)',
};

export function Sparkline({
  data = [],
  width = 120,
  height = 32,
  tone = 'accent',
  fill = true,
  threshold,
  strokeWidth = 1.5,
  dot = true,
  style,
}: SparklineProps) {
  const color = TONES[tone] || TONES.accent;
  const pts = data.length ? data : [0];
  const max = Math.max(...pts, threshold ?? -Infinity);
  const min = Math.min(...pts);
  const span = max - min || 1;
  const step = pts.length > 1 ? width / (pts.length - 1) : width;
  const y = (v: number) => height - ((v - min) / span) * (height - 4) - 2;
  const line = pts.map((v, i) => (i ? 'L' : 'M') + (i * step).toFixed(2) + ' ' + y(v).toFixed(2)).join(' ');
  const rawId = useId();
  const id = rawId.replace(/:/g, '');
  const gradientId = 'sp' + id;

  return (
    <svg
      width={width}
      height={height}
      viewBox={'0 0 ' + width + ' ' + height}
      preserveAspectRatio="none"
      className={s.svg}
      style={style}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {threshold != null && (
        <line
          x1="0"
          y1={y(threshold)}
          x2={width}
          y2={y(threshold)}
          stroke="var(--danger)"
          strokeWidth="1"
          strokeDasharray="3 4"
          opacity="0.45"
        />
      )}
      {fill && (
        <path
          d={line + ' L' + width + ' ' + height + ' L0 ' + height + ' Z'}
          fill={'url(#' + gradientId + ')'}
        />
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {dot && <circle cx={(pts.length - 1) * step} cy={y(pts[pts.length - 1])} r="2" fill={color} />}
    </svg>
  );
}
