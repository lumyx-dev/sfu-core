"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = ({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) => (
  <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />
);

/** Underline tabs — the toolbar tier. Selection is an indigo rule, not a pill. */
const TabsList = ({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List
    data-slot="tabs-list"
    className={cn("flex items-center gap-1 border-b border-hairline", className)}
    {...props}
  />
);

const TabsTrigger = ({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    data-slot="tabs-trigger"
    className={cn(
      "relative -mb-px h-9 px-3 text-13 font-medium text-muted transition-colors duration-[120ms]",
      "border-b-2 border-transparent hover:text-strong",
      "data-[state=active]:text-strong data-[state=active]:border-accent",
      "outline-none focus-visible:shadow-[var(--ring-accent)] rounded-t-xs",
      "disabled:opacity-45 disabled:cursor-not-allowed",
      className
    )}
    {...props}
  />
);

const TabsContent = ({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content data-slot="tabs-content" className={cn("outline-none", className)} {...props} />
);

export { Tabs, TabsList, TabsTrigger, TabsContent };
