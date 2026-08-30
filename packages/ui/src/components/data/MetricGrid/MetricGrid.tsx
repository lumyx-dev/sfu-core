import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './MetricGrid.module.css';

export interface MetricGridProps {
  children?: ReactNode;
  columns?: number;
  divided?: boolean;
  style?: CSSProperties;
}

/* Source :817-834. columns est une valeur runtime -> gridTemplateColumns reste inline
   (regle §5, meme traitement que DashboardGrid). divided est une prop-conditioned style
   -> classe (gap + background des separateurs 1px). */
export function MetricGrid({ children, columns = 4, divided = true, style }: MetricGridProps) {
  return (
    <div
      className={cn(s.grid, divided && s.divided)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, ...style }}
    >
      {children}
    </div>
  );
}
