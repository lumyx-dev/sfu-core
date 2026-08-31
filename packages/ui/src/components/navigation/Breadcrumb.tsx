import { Fragment, type ReactNode } from "react";

import { Icon } from "../core/Icon";
import { cn } from "../../lib/cn";

export interface BreadcrumbItem {
  id?: string;
  label: ReactNode;
}

export interface BreadcrumbProps {
  /** Last item is the current page: strong, not clickable. */
  items?: BreadcrumbItem[];
  onSelect?: (id: string | undefined, index: number) => void;
  className?: string;
}

export function Breadcrumb({ items = [], onSelect, className }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2 text-13",
        className,
      )}
    >
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={item.id ?? i}>
            {i > 0 && <Icon name="chevron-right" size={14} className="text-faint" />}
            <button
              type="button"
              aria-current={last ? "page" : undefined}
              onClick={
                !last && onSelect ? () => onSelect(item.id, i) : undefined
              }
              className={cn(
                "max-w-[220px] truncate border-none bg-transparent p-0 text-13",
                "focus-visible:outline-none focus-visible:shadow-ring-accent",
                last
                  ? "cursor-default font-medium text-strong"
                  : "cursor-pointer font-normal text-muted hover:text-strong",
              )}
            >
              {item.label}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
