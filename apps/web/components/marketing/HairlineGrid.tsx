import type { ReactNode } from 'react';
import s from './HairlineGrid.module.css';

export interface HairlineGridProps {
  columns: number;
  children: ReactNode;
  className?: string;
}

// The pricing grid on Home (Home.dc.html:263) is exactly this pattern: `gap:1px` on a
// `--border-subtle` ground, with each cell painting its own `--surface-card` background so the
// gaps read as continuous 1px hairlines. `columns` is a runtime value, so `gridTemplateColumns`
// stays inline (same treatment as MetricGrid/DashboardGrid in @lumyx/ui).
export function HairlineGrid({ columns, children, className }: HairlineGridProps) {
  const colsClass = s[`cols-${columns}`];
  return (
    <div
      className={[s.grid, colsClass, className].filter(Boolean).join(' ')}
      // Only a fallback for column counts with no pre-declared `.cols-N` responsive variant in
      // HairlineGrid.module.css — when colsClass exists, the stylesheet rule already sets this
      // and an inline style would just block the responsive breakpoints from ever applying.
      style={colsClass ? undefined : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
