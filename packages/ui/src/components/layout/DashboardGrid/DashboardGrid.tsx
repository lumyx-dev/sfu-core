import type { CSSProperties, ReactNode } from 'react';
import s from './DashboardGrid.module.css';

export interface DashboardGridProps {
  children?: ReactNode;
  columns?: number;
  gap?: CSSProperties['gap'];
  minColumn?: number;
  auto?: boolean;
  style?: CSSProperties;
}

export function DashboardGrid({
  children,
  columns = 12,
  gap = 'var(--gap-grid)',
  minColumn = 280,
  auto = false,
  style,
}: DashboardGridProps) {
  return (
    <div
      className={s.grid}
      style={{
        gridTemplateColumns: auto
          ? `repeat(auto-fit, minmax(${minColumn}px, 1fr))`
          : `repeat(${columns}, minmax(0, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface GridItemProps {
  children?: ReactNode;
  span?: number;
  rowSpan?: number;
  style?: CSSProperties;
}

export function GridItem({ children, span = 12, rowSpan, style }: GridItemProps) {
  return (
    <div
      className={s.item}
      style={{
        gridColumn: `span ${span}`,
        gridRow: rowSpan ? `span ${rowSpan}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
