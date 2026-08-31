"use client";

import type { ReactNode } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";

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
 *
 * Bundles its own `Toast.Provider`/`Toast.Viewport` rather than requiring one
 * from an ancestor: Radix's `Toast.Root` needs that context, and this
 * component is used standalone in places (no `ToastStack` wrapper), so making
 * it self-sufficient keeps every existing call site working unchanged.
 * `open` is always true — dismissal is still the consumer's call via
 * `onDismiss`, exactly as before; this only swaps the DOM/a11y engine
 * (role="status" live region, swipe-to-dismiss) underneath the same props.
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
    <ToastPrimitive.Provider swipeDirection="right">
      <ToastPrimitive.Root
        open
        onOpenChange={(open) => {
          if (!open) onDismiss?.();
        }}
        className={cn(
          "flex w-[340px] items-start gap-3 rounded-card border border-border bg-card p-4 shadow-lg",
          "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
          "data-[state=closed]:animate-none",
          className,
        )}
      >
        <span className={cn("mt-px flex flex-none", s.text)}>
          <Icon name={s.icon} size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <ToastPrimitive.Title className="text-13 font-medium text-strong">
            {title}
          </ToastPrimitive.Title>
          {message && (
            <ToastPrimitive.Description className="text-12 leading-snug text-muted">
              {message}
            </ToastPrimitive.Description>
          )}
        </div>
        {time && <span className="sl-num flex-none text-11 text-faint">{time}</span>}
        {onDismiss && (
          <ToastPrimitive.Close
            aria-label="Dismiss"
            className="flex flex-none cursor-pointer border-none bg-transparent p-0 text-faint hover:text-strong"
          >
            <Icon name="x" size={14} />
          </ToastPrimitive.Close>
        )}
      </ToastPrimitive.Root>
      <ToastPrimitive.Viewport className="contents" />
    </ToastPrimitive.Provider>
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

/** Pure positioning — each `Toast` child is already self-sufficient (see above). */
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
