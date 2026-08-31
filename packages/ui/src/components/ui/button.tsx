import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from '../../lib/utils';

/**
 * Press is a 120ms colour settle — no scale, no bounce, no squish.
 * Focus is the 3px indigo ring, never a browser outline.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-[120ms] ease-[var(--ease-out)] outline-none focus-visible:border-accent focus-visible:shadow-[var(--ring-accent)] disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 [&_svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent border border-transparent hover:bg-accent-hover shadow-[var(--shadow-xs)]",
        secondary: "bg-card text-strong border border-stroke hover:bg-hover shadow-[var(--shadow-xs)]",
        ghost: "bg-transparent text-body border border-transparent hover:bg-hover",
        danger: "bg-danger text-white border border-transparent hover:brightness-95 focus-visible:shadow-[var(--ring-danger)]",
        link: "bg-transparent text-accent-text underline-offset-2 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-12",
        md: "h-9 rounded-sm px-4 text-13",
        lg: "h-11 rounded-md px-5 text-14",
        icon: "size-9 rounded-sm px-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

function Button({
  className, variant, size, asChild = false, ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
