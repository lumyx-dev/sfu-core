import * as React from "react";
import { cn } from '../../lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full rounded-sm border border-stroke bg-card px-3 text-13 text-strong shadow-[var(--shadow-xs)]",
        "placeholder:text-faint transition-colors duration-[120ms]",
        "outline-none focus-visible:border-accent focus-visible:shadow-[var(--ring-accent)]",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        "aria-invalid:border-danger aria-invalid:focus-visible:shadow-[var(--ring-danger)]",
        className
      )}
      {...props}
    />
  );
}

export { Input };
