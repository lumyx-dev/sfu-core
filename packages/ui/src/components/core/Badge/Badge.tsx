import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './Badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'secondary' | 'ok' | 'warn' | 'danger' | 'info';

export interface BadgeProps {
  children?: ReactNode;
  tone?: BadgeTone;
  uppercase?: boolean;
  solid?: boolean;
  style?: CSSProperties;
}

export function Badge({
  children,
  tone = 'neutral',
  uppercase = false,
  solid = false,
  style,
}: BadgeProps) {
  return (
    <span
      className={cn(s.badge, s[tone], uppercase && s.uppercase, solid && s.solid)}
      style={style}
    >
      {children}
    </span>
  );
}
