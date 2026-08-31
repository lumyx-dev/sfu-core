import type { CSSProperties } from 'react';
import { cn } from '../../../lib/cn';
import s from './StatusDot.module.css';

export type StatusDotStatus =
  | 'live'
  | 'connected'
  | 'connecting'
  | 'degraded'
  | 'disconnected'
  | 'error'
  | 'idle';

export interface StatusDotProps {
  status?: StatusDotStatus;
  size?: number;
  halo?: boolean;
  style?: CSSProperties;
}

export function StatusDot({ status = 'idle', size = 8, halo = true, style }: StatusDotProps) {
  return (
    <span
      aria-label={status}
      className={cn(s.dot, s[status], halo && s.halo)}
      style={{ width: size, height: size, ...style }}
    />
  );
}
