import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface CardProps {
  /** Sentence case — "Round-trip time", not "Round-Trip Time". */
  title?: ReactNode;
  /** Quiet detail beside the title: a count, a window, a region. */
  meta?: ReactNode;
  /** Right-aligned controls in the header. */
  actions?: ReactNode;
  children?: ReactNode;
  /** Off when the body is a table or a chart that should bleed to the edge. */
  padded?: boolean;
  footer?: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

/** White card on the neutral page: 1px hairline, 18px radius, soft shadow. */
export function Card({
  title,
  meta,
  actions,
  children,
  padded = true,
  footer,
  className,
  headerClassName,
  bodyClassName,
}: CardProps) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-card shadow-sm",
        className,
      )}
    >
      {(title || actions) && (
        <header
          className={cn(
            "flex flex-none items-center justify-between gap-3 px-5 py-3.5",
            headerClassName,
          )}
        >
          <span className="inline-flex min-w-0 items-baseline gap-2">
            <h3 className="text-14 font-semibold text-strong">{title}</h3>
            {meta && <span className="text-12 text-muted">{meta}</span>}
          </span>
          {actions && (
            <span className="inline-flex items-center gap-2">{actions}</span>
          )}
        </header>
      )}
      <div className={cn("min-h-0 flex-1", padded && "px-5 pb-5", bodyClassName)}>
        {children}
      </div>
      {footer && (
        <div className="border-t border-border-subtle px-5 py-3 text-12 text-muted">
          {footer}
        </div>
      )}
    </section>
  );
}
