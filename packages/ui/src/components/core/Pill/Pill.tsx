import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { StatusDot, type StatusDotStatus } from '../StatusDot';
import s from './Pill.module.css';

export type PillTone = 'neutral' | 'accent' | 'secondary' | 'ok' | 'warn' | 'danger' | 'info' | 'muted';

export interface PillProps {
  children?: ReactNode;
  status?: StatusDotStatus;
  count?: ReactNode;
  tone?: PillTone;
  style?: CSSProperties;
}

export function Pill({ children, status, count, tone = 'neutral', style }: PillProps) {
  return (
    <span className={cn(s.pill, s[tone])} style={style}>
      {status && <StatusDot status={status} />}
      {children}
      {count != null && <span className={cn('sl-num', s.count)}>{count}</span>}
    </span>
  );
}
