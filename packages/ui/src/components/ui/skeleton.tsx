import { cn } from '../../lib/utils';

/** One slow neutral shimmer — 1.6s. Never a coloured one. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("relative overflow-hidden rounded-sm bg-inset", className)}
      {...props}
    >
      <div className="absolute inset-0 animate-[var(--animate-shimmer)] bg-gradient-to-r from-transparent via-black/[.04] to-transparent" />
    </div>
  );
}

export { Skeleton };
