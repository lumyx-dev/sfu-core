import type { ReactNode } from "react";

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

export function Tabs({
  tabs = [],
  activeId,
  onSelect,
  variant = "underline",
  className,
}: TabsProps) {
  const segmented = variant === "segmented";
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-stretch",
        segmented
          ? "w-max gap-0.5 rounded-control border border-border bg-inset p-[3px]"
          : "w-full gap-4 border-b border-border",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onSelect ? () => onSelect(t.id) : undefined}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 whitespace-nowrap border-none bg-transparent text-13",
              "transition duration-120 ease-out focus-visible:outline-none focus-visible:shadow-ring-accent",
              segmented ? "rounded-chip px-3 py-[5px]" : "rounded-none px-0 pb-[11px] pt-0",
              active ? "font-medium" : "font-normal text-muted hover:text-strong",
              active &&
                (segmented
                  ? "bg-card text-strong shadow-xs"
                  : "text-accent-text shadow-[inset_0_-2px_0_var(--sl-accent)]"),
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="sl-num text-11 text-muted">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
