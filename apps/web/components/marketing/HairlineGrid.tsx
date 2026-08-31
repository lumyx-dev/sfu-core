import type { ReactNode } from 'react';

export interface HairlineGridProps {
  columns: number;
  children: ReactNode;
  className?: string;
}

// The pricing grid on Home (Home.dc.html:263) is exactly this pattern: `gap:1px` on a
// `--border-subtle` ground, with each cell painting its own `--surface-card` background so the
// gaps read as continuous 1px hairlines. `columns` is a runtime value, so its responsive class
// list comes from this lookup (mobile-first, unlike the .cols-N max-width rules it replaces) —
// add a case here as a later page reuses this component with a different count.
const COLS: Record<number, string> = {
  // Home's pricing strip (task-6/8): 5 columns down to 2 at 1120px, 1 at 768px.
  5: 'grid-cols-1 md:grid-cols-2 min-[1120px]:grid-cols-5',
  // Compare LiveKit SUMMARY strip (task 9): 3 columns down to 1 at 768px.
  3: 'grid-cols-1 md:grid-cols-3',
  // Compare LiveKit REPLACES grid (task 9): 2 columns down to 1 at 640px.
  2: 'grid-cols-1 sm:grid-cols-2',
};

export function HairlineGrid({ columns, children, className }: HairlineGridProps) {
  const colsClass = COLS[columns];
  return (
    <div
      className={[
        'grid gap-px bg-border-subtle border border-border rounded-card overflow-hidden',
        colsClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      // Only a fallback for column counts with no entry in COLS above — when colsClass exists,
      // the Tailwind classes already set this and an inline style would just block the
      // responsive breakpoints from ever applying.
      style={colsClass ? undefined : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
