import type { CSSProperties, ReactNode } from 'react';
import s from './SplitPane.module.css';

export interface SplitPaneProps {
  left?: ReactNode;
  right?: ReactNode;
  railWidth?: number;
  gap?: CSSProperties['gap'];
  reverse?: boolean;
  style?: CSSProperties;
}

export function SplitPane({
  left,
  right,
  railWidth = 340,
  gap = 'var(--gap-grid)',
  reverse = false,
  style,
}: SplitPaneProps) {
  const cols = reverse ? `${railWidth}px minmax(0,1fr)` : `minmax(0,1fr) ${railWidth}px`;
  return (
    <div className={s.split} style={{ gridTemplateColumns: cols, gap, ...style }}>
      <div className={s.pane}>{reverse ? right : left}</div>
      <div className={s.pane}>{reverse ? left : right}</div>
    </div>
  );
}
