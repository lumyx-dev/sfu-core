import type { ReactNode, SelectHTMLAttributes } from "react";

import { Icon } from "./Icon";
import { cn } from "../../lib/cn";

export type SelectOption = string | { value: string; label: ReactNode };

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "children"> {
  label?: ReactNode;
  /** Bare strings become `{ value, label }` with the same text for both. */
  options?: SelectOption[];
  size?: "sm" | "md";
  className?: string;
  wrapperClassName?: string;
}

export function Select({
  label,
  options = [],
  size = "md",
  className,
  wrapperClassName,
  ...rest
}: SelectProps) {
  return (
    <label className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      {label && <span className="sl-label">{label}</span>}
      <span className="relative flex items-center">
        <select
          className={cn(
            "w-full cursor-pointer appearance-none rounded-control border border-border bg-card",
            "text-13 text-strong shadow-xs outline-none",
            "transition-[border-color,box-shadow] duration-120 ease-out",
            "focus-visible:border-accent focus-visible:shadow-ring-accent",
            "disabled:cursor-not-allowed disabled:opacity-45",
            size === "sm" ? "py-[7px] pl-3 pr-8" : "py-2.5 pl-3.5 pr-8",
            className,
          )}
          {...rest}
        >
          {options.map((o) => {
            const opt = typeof o === "string" ? { value: o, label: o } : o;
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })}
        </select>
        <Icon
          name="chevron-down"
          size={12}
          className="pointer-events-none absolute right-3 text-faint"
        />
      </span>
    </label>
  );
}
