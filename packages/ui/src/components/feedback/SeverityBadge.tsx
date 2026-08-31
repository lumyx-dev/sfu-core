import type { ReactNode } from "react";

import { SEVERITY, type Severity } from "./severity";
import { Icon } from "../core/Icon";
import { cn } from "../../lib/cn";

export interface SeverityBadgeProps {
  severity?: Severity;
  /** Overrides the default word ("Critical", "Warning", "Info", "Resolved"). */
  label?: ReactNode;
  showIcon?: boolean;
  className?: string;
}

export function SeverityBadge({
  severity = "info",
  label,
  showIcon = true,
  className,
}: SeverityBadgeProps) {
  const s = SEVERITY[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip px-2 py-[3px]",
        "text-11 font-medium uppercase tracking-label",
        s.tint,
        s.text,
        className,
      )}
    >
      {showIcon && <Icon name={s.icon} size={12} />}
      {label || s.label}
    </span>
  );
}
