import type { CSSProperties, ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface DashboardGridProps {
  children: ReactNode;
  /** The house dashboard grid is 12 columns with 16px gutters. */
  columns?: number;
  /** Ignore `columns` and fit as many `minColumn`-wide tracks as will fit. */
  auto?: boolean;
  minColumn?: number;
  className?: string;
}

export function DashboardGrid({
  children,
  columns = 12,
  auto = false,
  minColumn = 280,
  className,
}: DashboardGridProps) {
  return (
    <div
      style={
        {
          "--grid-columns": columns,
          "--grid-min": `${minColumn}px`,
        } as CSSProperties & Record<string, string | number>
      }
      className={cn(
        "grid min-w-0 content-start gap-4",
        auto
          ? "grid-cols-[repeat(auto-fit,minmax(var(--grid-min),1fr))]"
          : "grid-cols-[repeat(var(--grid-columns),minmax(0,1fr))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface GridItemProps {
  children: ReactNode;
  /** Columns to span, out of the parent's `columns`. */
  span?: number;
  rowSpan?: number;
  className?: string;
}

export function GridItem({
  children,
  span = 12,
  rowSpan,
  className,
}: GridItemProps) {
  return (
    <div
      style={{
        gridColumn: `span ${span}`,
        gridRow: rowSpan ? `span ${rowSpan}` : undefined,
      }}
      className={cn("flex min-w-0 flex-col gap-4", className)}
    >
      {children}
    </div>
  );
}
