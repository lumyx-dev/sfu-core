import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix" | "size"> {
  /** Rendered as the 11px uppercase micro-label. */
  label?: ReactNode;
  /** Quiet helper line under the field. Suppressed while `error` is set. */
  hint?: ReactNode;
  /**
   * Error message. Show the raw string a failure produced — never paraphrase
   * an error away from the person who has to fix it.
   */
  error?: ReactNode;
  /** Leading adornment, usually a 16px Icon. */
  prefix?: ReactNode;
  /** Trailing adornment, usually a unit: "ms", "%", "Mbps". */
  suffix?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  wrapperClassName?: string;
}

export function Input({
  label,
  hint,
  error,
  prefix,
  suffix,
  size = "md",
  className,
  wrapperClassName,
  ...rest
}: InputProps) {
  const invalid = Boolean(error);
  return (
    <label className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      {label && <span className="sl-label">{label}</span>}
      <span
        className={cn(
          "flex items-center gap-2 rounded-control border bg-card shadow-xs",
          "transition-[border-color,box-shadow] duration-120 ease-out",
          size === "sm" ? "px-3 py-[7px]" : "px-3.5 py-2.5",
          invalid
            ? "border-danger focus-within:shadow-ring-danger"
            : "border-border focus-within:border-accent focus-within:shadow-ring-accent",
        )}
      >
        {prefix && (
          <span className="inline-flex text-faint">{prefix}</span>
        )}
        <input
          aria-invalid={invalid || undefined}
          className={cn(
            "min-w-0 flex-1 border-none bg-transparent p-0 text-13 text-strong outline-none",
            "placeholder:text-faint",
            className,
          )}
          {...rest}
        />
        {suffix && <span className="text-12 text-muted">{suffix}</span>}
      </span>
      {(hint || error) && (
        <span className={cn("text-12", invalid ? "text-danger" : "text-muted")}>
          {error || hint}
        </span>
      )}
    </label>
  );
}
