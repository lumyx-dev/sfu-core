"use client";
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

function Progress({
  className, value = 0, indicatorClassName, ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("relative h-1.5 w-full overflow-hidden rounded-pill bg-inset", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-pill bg-accent transition-[width] duration-[260ms] ease-[var(--ease-out)]", indicatorClassName)}
        style={{ width: `${value ?? 0}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
