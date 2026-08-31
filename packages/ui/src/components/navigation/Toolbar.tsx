import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface ToolbarProps {
  /** Leading content: a breadcrumb, a title, a tab switch. */
  left?: ReactNode;
  /** Trailing actions, right-aligned. */
  right?: ReactNode;
  /** Rendered after `left`, in the same group. */
  children?: ReactNode;
  /** Pins to the top of the scroll container. */
  sticky?: boolean;
  className?: string;
}

/** The chrome above a view. Sits on the card surface, not the page. */
export function Toolbar({
  left,
  right,
  children,
  sticky = false,
  className,
}: ToolbarProps) {
  return (
    <div
      className={cn(
        "flex min-h-[60px] items-center justify-between gap-4 border-b border-border bg-card px-6 py-3",
        sticky && "sticky top-0 z-10",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        {left}
        {children}
      </span>
      <span className="flex flex-none items-center gap-2">{right}</span>
    </div>
  );
}
