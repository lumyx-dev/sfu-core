"use client";

import type { ReactNode } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "../../lib/cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Trailing count. `0` still renders. */
  count?: number;
}

export interface TabsProps {
  tabs?: TabItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  /**
   * `underline` for primary sections of a view; `segmented` for a compact
   * switch inside a toolbar or a card header.
   */
  variant?: "underline" | "segmented";
  className?: string;
}

/**
 * A tab strip, not a tab-with-panels widget: this repo always renders its own
 * content based on `activeId`, so only `Tabs.Root` + `Tabs.List` +
 * `Tabs.Trigger` are used — no `Tabs.Content`. Radix adds roving tabindex and
 * arrow-key navigation over the previous hand-rolled `role="tablist"` version;
 * `activeId`/`onSelect` map onto Radix's `value`/`onValueChange` 1:1, so the
 * public API is unchanged.
 */
export function Tabs({
  tabs = [],
  activeId,
  onSelect,
  variant = "underline",
  className,
}: TabsProps) {
  const segmented = variant === "segmented";
  return (
    <TabsPrimitive.Root value={activeId} onValueChange={onSelect}>
      <TabsPrimitive.List
        className={cn(
          "inline-flex items-stretch",
          segmented
            ? "w-max gap-0.5 rounded-control border border-border bg-inset p-[3px]"
            : "w-full gap-4 border-b border-border",
          className,
        )}
      >
        {tabs.map((t) => (
          <TabsPrimitive.Trigger
            key={t.id}
            value={t.id}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 whitespace-nowrap border-none bg-transparent text-13",
              "transition duration-120 ease-out outline-none focus-visible:shadow-ring-accent",
              segmented ? "rounded-chip px-3 py-[5px]" : "rounded-none px-0 pb-[11px] pt-0",
              "font-normal text-muted hover:text-strong",
              "data-[state=active]:font-medium data-[state=active]:text-strong",
              segmented
                ? "data-[state=active]:bg-card data-[state=active]:text-strong data-[state=active]:shadow-xs"
                : "data-[state=active]:text-accent-text data-[state=active]:shadow-[inset_0_-2px_0_var(--sl-accent)]",
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="sl-num text-11 text-muted">{t.count}</span>
            )}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
