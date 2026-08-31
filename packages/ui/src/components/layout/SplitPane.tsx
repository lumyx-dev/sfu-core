import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface SplitPaneProps {
  /** The canvas. */
  left?: ReactNode;
  /** The context rail — 340px, fixed. */
  right?: ReactNode;
  railWidth?: number;
  /** Puts the rail on the left instead. */
  reverse?: boolean;
  className?: string;
}

/** A detail view: canvas plus a fixed context rail. */
export function SplitPane({
  left,
  right,
  railWidth = 340,
  reverse = false,
  className,
}: SplitPaneProps) {
  const rail = `${railWidth}px`;
  return (
    <div
      style={{
        gridTemplateColumns: reverse
          ? `${rail} minmax(0,1fr)`
          : `minmax(0,1fr) ${rail}`,
      }}
      className={cn("grid min-w-0 items-start gap-4", className)}
    >
      <div className="flex min-w-0 flex-col gap-4">{reverse ? right : left}</div>
      <div className="flex min-w-0 flex-col gap-4">{reverse ? left : right}</div>
    </div>
  );
}
