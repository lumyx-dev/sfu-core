import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  /** Required — this control has no visible text. Used for both title and label. */
  label: string;
  /** Square edge length in px. Default 32. */
  size?: number;
  /** Held-down state: a toolbar toggle that is currently on. */
  active?: boolean;
  tone?: "default" | "danger";
}

export function IconButton({
  children,
  label,
  size = 32,
  active = false,
  tone = "default",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-control border p-0 text-muted",
        "transition duration-120 ease-out outline-none",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none",
        tone === "danger"
          ? "hover:bg-danger-tint hover:text-danger focus-visible:shadow-ring-danger"
          : "hover:bg-accent-tint hover:text-accent-text focus-visible:shadow-ring-accent",
        active
          ? tone === "danger"
            ? "border-danger bg-danger-tint text-danger"
            : "border-accent-border bg-accent-tint text-accent-text"
          : "border-transparent bg-transparent",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
