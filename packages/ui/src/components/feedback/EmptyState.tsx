import type { ReactNode } from "react";

import { Icon, type IconName } from "../core/Icon";
import { cn } from "../../lib/cn";

export interface EmptyStateProps {
  icon?: IconName;
  /** Name what is absent: "No active rooms." No "Oops", no exclamation marks. */
  title?: ReactNode;
  /** Say how data arrives: "Rooms appear here as soon as a peer joins." */
  hint?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon = "radio-tower",
  title,
  hint,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        compact ? "px-5 py-8" : "px-6 py-12",
        className,
      )}
    >
      <span className="mb-1.5 inline-flex size-11 items-center justify-center rounded-tile bg-inset text-faint">
        <Icon name={icon} size={20} />
      </span>
      <span className="text-14 font-medium text-strong">{title}</span>
      {hint && (
        <span className="max-w-[380px] text-13 leading-snug text-muted">
          {hint}
        </span>
      )}
      {action && <span className="mt-2">{action}</span>}
    </div>
  );
}
