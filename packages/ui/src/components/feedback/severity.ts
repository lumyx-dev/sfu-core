import type { IconName } from "../core/Icon";

/**
 * The four alert levels, shared by SeverityBadge, AlertBanner and Toast
 * (upstream duplicates this map in all three files).
 *
 * `success` reads as "Resolved" — in an alerting product the success case is an
 * alert that cleared, not an action that worked.
 */
export const SEVERITY = {
  critical: {
    text: "text-danger",
    tint: "bg-danger-tint",
    rule: "border-l-danger",
    icon: "circle-alert",
    label: "Critical",
  },
  warning: {
    text: "text-warn",
    tint: "bg-warn-tint",
    rule: "border-l-warn",
    icon: "triangle-alert",
    label: "Warning",
  },
  info: {
    text: "text-info",
    tint: "bg-info-tint",
    rule: "border-l-info",
    icon: "info",
    label: "Info",
  },
  success: {
    text: "text-ok",
    tint: "bg-ok-tint",
    rule: "border-l-ok",
    icon: "circle-check",
    label: "Resolved",
  },
} as const satisfies Record<
  string,
  { text: string; tint: string; rule: string; icon: IconName; label: string }
>;

export type Severity = keyof typeof SEVERITY;
