import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-xs border px-2 py-0.5 text-11 font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-inset text-muted border-hairline",
        accent: "bg-accent-tint text-accent-text border-accent-border",
        room: "bg-accent2-tint text-[var(--coral-600)] border-transparent",
        ok: "bg-ok-tint text-ok border-transparent",
        warn: "bg-warn-tint text-warn border-transparent",
        danger: "bg-danger-tint text-danger border-transparent",
        info: "bg-info-tint text-info border-transparent",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

function Badge({
  className, tone, asChild = false, ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
