import type { CSSProperties } from "react";

import { cn } from "../../lib/cn";

/** One slow neutral shimmer — the system's only other animation. */
function Bar({
  width,
  height,
  className,
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <span
      style={{ width, height } as CSSProperties}
      className={cn(
        "relative block overflow-hidden rounded-full bg-inset",
        className,
      )}
    >
      <span
        className="absolute inset-0 animate-shimmer"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--sl-text-muted) 12%, transparent), transparent)",
        }}
      />
    </span>
  );
}

export type SkeletonVariant = "rows" | "metric" | "chart" | "tile";

export interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  /** `rows` only. */
  rows?: number;
  /** `metric` only. */
  columns?: number;
  className?: string;
}

export function LoadingSkeleton({
  variant = "rows",
  rows = 4,
  columns = 4,
  className,
}: LoadingSkeletonProps) {
  if (variant === "metric") {
    return (
      <div
        style={
          { "--skeleton-columns": columns } as CSSProperties &
            Record<string, number>
        }
        className={cn(
          "grid grid-cols-[repeat(var(--skeleton-columns),minmax(0,1fr))] gap-px bg-border-subtle",
          className,
        )}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 bg-card px-5 py-4">
            <Bar width="52px" height="8px" />
            <Bar width="74px" height="22px" className="rounded-chip" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div
        className={cn("flex h-40 items-end gap-1.5 py-4", className)}
      >
        {Array.from({ length: 28 }).map((_, i) => (
          <Bar
            key={i}
            width="100%"
            height={`${26 + ((i * 41) % 66)}%`}
            className="rounded-chip"
          />
        ))}
      </div>
    );
  }

  if (variant === "tile") {
    return (
      <div
        className={cn(
          "aspect-16/10 overflow-hidden rounded-card border border-border",
          className,
        )}
      >
        <Bar width="100%" height="100%" className="rounded-none" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4 py-4", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Bar width="8px" height="8px" className="flex-none" />
          <Bar width={`${34 + ((i * 23) % 44)}%`} height="10px" />
          <Bar width="56px" height="10px" className="ml-auto flex-none" />
        </div>
      ))}
    </div>
  );
}
