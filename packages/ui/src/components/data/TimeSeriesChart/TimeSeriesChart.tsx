import { useId } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '../../../lib/cn';
import s from './TimeSeriesChart.module.css';

export type TimeSeriesChartTone = 'accent' | 'secondary' | 'warn' | 'neutral' | 'ok';

export interface TimeSeriesChartSeries {
  data: number[];
  tone?: TimeSeriesChartTone;
  fill?: boolean;
  name?: string;
}

export interface TimeSeriesChartProps {
  series?: TimeSeriesChartSeries[];
  labels?: string[];
  height?: number;
  threshold?: number;
  thresholdLabel?: string;
  yTicks?: number;
  unit?: string;
  cursor?: number;
  style?: CSSProperties;
}

/* Source :1013-1219, le plus gros composant du systeme. `cursor` est bien une valeur
   passee par l'appelant (positionnement d'une div a `cursor + '%'`) : aucun useState,
   aucun useEffect dans ce composant — seul React.useId() est utilise (comme dans
   Sparkline), donc pas de 'use client' ici (relevé de hooks §5 confirme). TONES ici
   n'a QUE 5 entrees (accent/secondary/warn/neutral/ok -> --series-1..5) : pas de clef
   "danger", contrairement a Sparkline.TONES qui en a une (cf. rapport). Les couleurs
   de serie ne "tournent" PAS automatiquement sur --series-1..5 par index : chaque
   serie choisit sa couleur via sa propre prop `tone` (repli sur --series-1 si absente
   ou inconnue) — la source ne fait aucun modulo sur l'index (divergence avec le brief,
   voir rapport). Le degrade sous chaque courbe va de stopOpacity 0.14 (haut) a 0
   (bas) — different du 0.16 de Sparkline, transcrit tel quel, ne pas harmoniser.
   Toute l'arithmetique (max*1.08, y(), step, d, ticks) est recopiee a l'identique. */
const TONES: Record<string, string> = {
  accent: 'var(--series-1)',
  secondary: 'var(--series-2)',
  warn: 'var(--series-3)',
  neutral: 'var(--series-4)',
  ok: 'var(--series-5)',
};

function toneColor(tone: TimeSeriesChartTone | undefined): string {
  const key = tone ?? 'accent';
  return TONES[key] || TONES.accent;
}

export function TimeSeriesChart({
  series = [],
  labels = [],
  height = 180,
  threshold,
  thresholdLabel,
  yTicks = 4,
  unit = '',
  cursor,
  style,
}: TimeSeriesChartProps) {
  const all = series.flatMap((sr) => sr.data);
  const max = Math.max(...all, threshold ?? -Infinity) * 1.08 || 1;
  const min = 0;
  const W = 1000;
  const H = height;
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H;
  const rawId = useId();
  const id = rawId.replace(/:/g, '');
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => min + ((max - min) / yTicks) * i);

  return (
    <div className={s.wrap} style={style}>
      <div className={s.row}>
        <div className={s.ticksCol} style={{ height: H }}>
          {ticks
            .slice()
            .reverse()
            .map((t, i) => (
              <span key={i} className={cn('sl-num', s.tickLabel)}>
                {Math.round(t)}
                {unit}
              </span>
            ))}
        </div>
        <div className={s.chartWrap}>
          <svg
            viewBox={'0 0 ' + W + ' ' + H}
            width="100%"
            height={H}
            preserveAspectRatio="none"
            className={s.svg}
          >
            <defs>
              {series.map((sr, i) => (
                <linearGradient key={i} id={'ts' + id + i} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={toneColor(sr.tone)} stopOpacity="0.14" />
                  <stop offset="100%" stopColor={toneColor(sr.tone)} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {ticks.map((t, i) => (
              <line
                key={i}
                x1="0"
                y1={y(t)}
                x2={W}
                y2={y(t)}
                stroke="var(--border-subtle)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {threshold != null && (
              <line
                x1="0"
                y1={y(threshold)}
                x2={W}
                y2={y(threshold)}
                stroke="var(--danger)"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.6"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {series.map((sr, i) => {
              const step = sr.data.length > 1 ? W / (sr.data.length - 1) : W;
              const line = sr.data
                .map((v, k) => (k ? 'L' : 'M') + (k * step).toFixed(1) + ' ' + y(v).toFixed(1))
                .join(' ');
              const color = toneColor(sr.tone);
              return (
                <g key={i}>
                  {sr.fill !== false && (
                    <path
                      d={line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z'}
                      fill={'url(#ts' + id + i + ')'}
                    />
                  )}
                  <path
                    d={line}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </svg>
          {cursor != null && <div className={s.cursor} style={{ left: cursor + '%' }} />}
          {threshold != null && thresholdLabel && (
            <span className={s.thresholdLabel} style={{ top: y(threshold) - 16 }}>
              {thresholdLabel}
            </span>
          )}
        </div>
      </div>
      <div className={s.labelsRow}>
        {labels.map((l) => (
          <span key={l} className={cn('sl-num', s.axisLabel)}>
            {l}
          </span>
        ))}
      </div>
      {series.length > 1 && (
        <div className={s.legendRow}>
          {series.map((sr, i) => (
            <span key={i} className={s.legendItem}>
              <span className={s.legendSwatch} style={{ background: toneColor(sr.tone) }} />
              {sr.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
