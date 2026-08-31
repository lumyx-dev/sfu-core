import type { ReactNode } from "react";

import { SEVERITY, type Severity } from "./severity";
import { Icon } from "../core/Icon";
import { IconButton } from "../core/IconButton";
import { cn } from "../../lib/cn";

export interface AlertBannerProps {
  severity?: Severity;
  /** State the condition: "Peer ff104b2c is degrading". */
  title?: ReactNode;
  /**
   * The condition, the duration, and the fix — "Packet loss has been above 2%
   * for 3m 12s. Force audio-only or renegotiate the session."
   */
  message?: ReactNode;
  /**
   * Machine context, rendered tabular:
   * `webinar-us · ap-south-1 · 14:06:41 · loss 7.90% vs 2%`.
   * Always the value *and* the threshold.
   */
  meta?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function AlertBanner({
  severity = "warning",
  title,
  message,
  meta,
  action,
  onDismiss,
  className,
}: AlertBannerProps) {
  const s = SEVERITY[severity];
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-card border border-border border-l-[3px] bg-card px-5 py-4 shadow-sm",
        s.rule,
        className,
      )}
    >
      <span className={cn("mt-px flex flex-none", s.text)}>
        <Icon name={s.icon} size={18} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {title && (
          <span className="text-14 font-medium text-strong">{title}</span>
        )}
        {message && (
          <span className="text-13 leading-snug text-body">{message}</span>
        )}
        {meta && (
          <span className="sl-num mt-0.5 text-12 text-muted">{meta}</span>
        )}
      </div>
      {action && (
        <span className="flex flex-none items-center gap-2">{action}</span>
      )}
      {onDismiss && (
        <IconButton label="Dismiss" size={28} onClick={onDismiss}>
          <Icon name="x" size={14} />
        </IconButton>
      )}
    </div>
  );
}
