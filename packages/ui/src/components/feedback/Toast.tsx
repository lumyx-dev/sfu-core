import type { ReactNode } from "react";

import { SEVERITY, type Severity } from "./severity";
import { Icon } from "../core/Icon";
import { cn } from "../../lib/cn";

export interface ToastProps {
  severity?: Severity;
  title: ReactNode;
  message?: ReactNode;
  /** Pre-formatted clock, rendered tabular. */
  time?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/**
 * An in-app notification surface. Flagged as an intentional addition: the
 * README promises Slack/email/PagerDuty alerting, but the repo has no in-app
 * notification surface yet.
 */
export function Toast({
  severity = "info",
  title,
  message,
  time,
  onDismiss,
  className,
}: ToastProps) {
  const s = SEVERITY[severity];
  return (
    <div
      role="alert"
      className={cn(
        "flex w-[340px] items-start gap-3 rounded-card border border-border bg-card p-4 shadow-lg",
        className,
      )}
    >
      <span className={cn("mt-px flex flex-none", s.text)}>
        <Icon name={s.icon} size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-13 font-medium text-strong">{title}</span>
        {message && (
          <span className="text-12 leading-snug text-muted">{message}</span>
        )}
      </div>
      {time && <span className="sl-num flex-none text-11 text-faint">{time}</span>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex flex-none cursor-pointer border-none bg-transparent p-0 text-faint hover:text-strong"
        >
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

export type ToastPlacement = "bottom-right" | "top-right" | "bottom-left";

const PLACEMENT: Record<ToastPlacement, string> = {
  "bottom-right": "bottom-6 right-6",
  "top-right": "top-6 right-6",
  "bottom-left": "bottom-6 left-6",
};

export interface ToastStackProps {
  children: ReactNode;
  placement?: ToastPlacement;
  className?: string;
}

export function ToastStack({
  children,
  placement = "bottom-right",
  className,
}: ToastStackProps) {
  return (
    <div
      className={cn(
        "absolute z-50 flex flex-col gap-3",
        PLACEMENT[placement],
        className,
      )}
    >
      {children}
    </div>
  );
}
