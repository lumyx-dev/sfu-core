import type { CSSProperties, ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface MetricGridProps {
  children: ReactNode;
  columns?: number;
  /**
   * The hairline treatment: a 1px gap over `--border-subtle`, so each cell's
   * own white paints the rules between them and the group reads as one
   * instrument rather than a row of separate cards.
   */
  divided?: boolean;
  className?: string;
}

export function MetricGrid({
  children,
  columns = 4,
  divided = true,
  className,
}: MetricGridProps) {
  return (
    <div
      style={
        { "--metric-columns": columns } as CSSProperties & Record<string, number>
      }
      className={cn(
        "grid grid-cols-[repeat(var(--metric-columns),minmax(0,1fr))]",
        divided ? "gap-px bg-border-subtle" : "gap-4 bg-transparent",
        className,
      )}
    >
      {children}
    </div>
  );
}
