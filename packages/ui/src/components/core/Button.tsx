import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "danger"
  | "accentQuiet";
export type ButtonSize = "sm" | "md" | "lg";

const SIZES: Record<ButtonSize, string> = {
  sm: "text-12 gap-1.5 rounded-control px-3 py-1.5",
  md: "text-13 gap-2 rounded-control px-4 py-[9px]",
  lg: "text-14 gap-2 rounded-tile px-5 py-3",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent border-accent text-on-accent shadow-xs hover:bg-accent-hover hover:border-accent-hover",
  secondary:
    "bg-card border-border text-strong shadow-xs hover:bg-hover hover:border-border-strong",
  quiet:
    "bg-transparent border-transparent text-muted hover:bg-hover hover:text-strong",
  danger:
    "bg-card border-border text-danger shadow-xs hover:bg-danger-tint hover:border-danger",
  accentQuiet:
    "bg-accent-tint border-accent-border text-accent-text hover:bg-accent-border",
};

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "prefix"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full-width, for sidebars and forms. */
  block?: boolean;
  /** Leading glyph. Buttons with a clear label usually don't need one. */
  icon?: ReactNode;
  /** Trailing glyph — a chevron on a menu trigger, a count. */
  trailing?: ReactNode;
}

export function Button({
  children,
  variant = "secondary",
  size = "md",
  block = false,
  icon = null,
  trailing = null,
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center whitespace-nowrap border font-medium tracking-normal outline-none",
        "transition duration-120 ease-out",
        // Press is a colour settle: no scale, no bounce, no squish.
        "focus-visible:shadow-ring-accent focus-visible:border-accent",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none",
        SIZES[size],
        VARIANTS[variant],
        variant === "danger" && "focus-visible:shadow-ring-danger focus-visible:border-danger",
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {trailing}
    </button>
  );
}
