import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './StatusStrip.module.css';

export type StatusStripItemTone = 'danger' | 'warn';

export interface StatusStripItem {
  label?: ReactNode;
  value?: ReactNode;
  tone?: StatusStripItemTone;
}

export interface StatusStripProps {
  left?: ReactNode;
  items?: StatusStripItem[];
  style?: CSSProperties;
}

export function StatusStrip({ left, items = [], style }: StatusStripProps) {
  return (
    <footer className={s.strip} style={style}>
      <span className={s.left}>{left}</span>
      <span className={s.items}>
        {items.map((it, i) => (
          <span key={i} className={s.item}>
            <span>{it.label}</span>
            <span className={cn('sl-num', s.value, it.tone === 'danger' && s.danger, it.tone === 'warn' && s.warn)}>
              {it.value}
            </span>
          </span>
        ))}
      </span>
    </footer>
  );
}
