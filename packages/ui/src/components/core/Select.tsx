"use client";

import type { ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";

import { Icon } from "./Icon";
import { cn } from "../../lib/cn";

export type SelectOption = string | { value: string; label: ReactNode };

export interface SelectProps {
  label?: ReactNode;
  /** Bare strings become `{ value, label }` with the same text for both. */
  options?: SelectOption[];
  size?: "sm" | "md";
  placeholder?: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
  wrapperClassName?: string;
}

/**
 * Was a native `<select>` styled to match the DS. Radix's listbox gives real
 * keyboard support (type-ahead, arrow navigation) and a positioned, portalled
 * menu instead of the browser's own — same trigger look, same props apart from
 * `onChange` becoming `onValueChange` (a plain string, not an event: nothing
 * in this repo used `onChange` on a Select, so this is not a breaking change
 * in practice).
 */
export function Select({
  label,
  options = [],
  size = "md",
  placeholder,
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
  className,
  wrapperClassName,
}: SelectProps) {
  const normalized = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));

  return (
    <label className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      {label && <span className="sl-label">{label}</span>}
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
      >
        <SelectPrimitive.Trigger
          className={cn(
            "flex w-full cursor-pointer items-center justify-between gap-2 rounded-control border border-border bg-card",
            "text-13 text-strong shadow-xs outline-none",
            "transition-[border-color,box-shadow] duration-120 ease-out",
            "focus-visible:border-accent focus-visible:shadow-ring-accent",
            "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45",
            size === "sm" ? "py-[7px] pl-3 pr-3" : "py-2.5 pl-3.5 pr-3.5",
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <Icon name="chevron-down" size={12} className="text-faint" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="z-50 overflow-hidden rounded-control border border-border bg-card text-13 text-strong shadow-md"
          >
            <SelectPrimitive.Viewport className="p-1">
              {normalized.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  className={cn(
                    "flex cursor-pointer select-none items-center rounded-chip px-3 py-[7px] outline-none",
                    "data-[highlighted]:bg-hover data-[state=checked]:font-medium",
                  )}
                >
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </label>
  );
}
