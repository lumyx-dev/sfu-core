import * as React from "react";
import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type Severity = "critical" | "warning" | "info" | "resolved";

const SEV = {
  critical: { tint: "bg-danger-tint", ink: "text-danger", Icon: XCircle, label: "Critical" },
  warning: { tint: "bg-warn-tint", ink: "text-warn", Icon: AlertTriangle, label: "Warning" },
  info: { tint: "bg-info-tint", ink: "text-info", Icon: Info, label: "Info" },
  resolved: { tint: "bg-ok-tint", ink: "text-ok", Icon: CheckCircle2, label: "Resolved" },
} as const;

export function SeverityBadge({ severity, children }: { severity: Severity; children?: React.ReactNode }) {
  const s = SEV[severity];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-11 font-medium", s.tint, s.ink)}>
      <s.Icon className="size-3 stroke-[1.75]" />
      {children ?? s.label}
    </span>
  );
}

/**
 * State the condition, the duration and the fix — then the machine context underneath.
 * Always the value AND the threshold.
 */
export function AlertBanner({
  severity = "warning", title, body, context, actionLabel, onAction,
}: {
  severity?: Severity; title: string; body?: string; context?: string;
  actionLabel?: string; onAction?: () => void;
}) {
  const s = SEV[severity];
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-hairline p-4", s.tint)}>
      <s.Icon className={cn("mt-0.5 size-4 shrink-0 stroke-[1.75]", s.ink)} />
      <div className="flex flex-1 flex-col gap-1">
        <p className={cn("text-13 font-semibold", s.ink)}>{title}</p>
        {body ? <p className="text-13 text-body">{body}</p> : null}
        {context ? <p className="sl-num text-11 text-muted">{context}</p> : null}
      </div>
      {actionLabel ? (
        <Button size="sm" variant="secondary" onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  );
}

/** Name what is absent and how data arrives. No "Oops", no exclamation marks. */
export function EmptyState({
  icon: Icon, title, body, action,
}: { icon?: React.ElementType; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      {Icon ? (
        <span className="flex size-10 items-center justify-center rounded-md border border-hairline bg-inset text-muted">
          <Icon className="size-5 stroke-[1.75]" />
        </span>
      ) : null}
      <p className="text-14 font-semibold text-strong">{title}</p>
      {body ? <p className="max-w-sm text-13 text-muted text-pretty">{body}</p> : null}
      {action}
    </div>
  );
}

/** A failure surfaces the code and the verbatim message in an inset block. */
export function ErrorState({ code, message, onRetry }: { code: string; message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-hairline bg-card p-5">
      <SeverityBadge severity="critical">{code}</SeverityBadge>
      <pre className="sl-num w-full overflow-x-auto rounded-sm bg-inset p-3 text-12 text-body whitespace-pre-wrap">{message}</pre>
      {onRetry ? <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button> : null}
    </div>
  );
}
