import type { ReactNode } from "react";

import { Icon } from "../core/Icon";
import { cn } from "../../lib/cn";

export interface ErrorStateProps {
  title?: ReactNode;
  message?: ReactNode;
  /** The raw code, e.g. `1006`. */
  code?: ReactNode;
  /**
   * The verbatim error string. Never paraphrase an error away from the person
   * who has to fix it — this renders in an inset block, as it came.
   */
  detail?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Something failed",
  message,
  code,
  detail,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-1.5 inline-flex size-11 items-center justify-center rounded-tile bg-danger-tint text-danger">
        <Icon name="circle-alert" size={20} />
      </span>
      <span className="text-14 font-medium text-strong">{title}</span>
      {message && (
        <span className="max-w-[400px] text-13 leading-snug text-muted">
          {message}
        </span>
      )}
      {(code || detail) && (
        <div className="sl-scroll sl-num mt-2 max-w-full overflow-x-auto whitespace-pre-wrap rounded-control border border-border-subtle bg-inset px-4 py-3 text-left text-12 text-danger">
          {code ? `${code}  ` : ""}
          {detail}
        </div>
      )}
      {action && <span className="mt-3">{action}</span>}
    </div>
  );
}
