import type { ReactNode } from "react";

import { Icon, type IconName } from "../core/Icon";
import { StatusDot, type Status } from "../core/StatusDot";
import { cn } from "../../lib/cn";

export interface SidebarLink {
  id: string;
  label: ReactNode;
  icon?: IconName;
  /** A trailing 6px dot — a room that is live, a source that is degraded. */
  status?: Status;
  /** Trailing count. `0` still renders. */
  count?: number;
  section?: never;
}

/** A micro-label divider between groups of links. */
export interface SidebarSection {
  section: ReactNode;
  id?: never;
}

export type SidebarItem = SidebarLink | SidebarSection;

export interface SidebarProps {
  items?: SidebarItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  /** The wordmark. Geist 600 at −0.02em — there is no logo mark. */
  brand?: ReactNode;
  /** Quiet line under the wordmark: a region, a version, an environment. */
  brandMeta?: ReactNode;
  footer?: ReactNode;
  /** Default 248px, the house sidebar width. */
  width?: number;
  className?: string;
}

export function Sidebar({
  items = [],
  activeId,
  onSelect,
  brand = "Sightline",
  brandMeta,
  footer,
  width = 248,
  className,
}: SidebarProps) {
  return (
    <nav
      style={{ width }}
      className={cn(
        "flex min-h-0 flex-none flex-col border-r border-border bg-card",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 px-4 pb-4 pt-5">
        <span className="text-16 font-semibold tracking-display text-strong">
          {brand}
        </span>
        {brandMeta && <span className="text-12 text-muted">{brandMeta}</span>}
      </div>

      <div className="sl-scroll flex-1 overflow-y-auto px-2 pb-4">
        {items.map((item, i) =>
          "section" in item && item.section != null ? (
            <div key={`s${i}`} className="sl-label px-2 pb-1.5 pt-4">
              {item.section}
            </div>
          ) : (
            <SidebarRow
              key={(item as SidebarLink).id}
              item={item as SidebarLink}
              active={(item as SidebarLink).id === activeId}
              onSelect={onSelect}
            />
          ),
        )}
      </div>

      {footer && (
        <div className="border-t border-border-subtle px-4 py-3 text-12 text-muted">
          {footer}
        </div>
      )}
    </nav>
  );
}

function SidebarRow({
  item,
  active,
  onSelect,
}: {
  item: SidebarLink;
  active: boolean;
  onSelect?: (id: string) => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onSelect ? () => onSelect(item.id) : undefined}
      className={cn(
        "mb-px flex w-full cursor-pointer items-center gap-3 rounded-control border-none px-2 py-[9px]",
        "text-left text-13 transition-colors duration-120 ease-out",
        "focus-visible:outline-none focus-visible:shadow-ring-accent",
        active
          ? "bg-accent-tint font-medium text-accent-text"
          : "bg-transparent font-normal text-body hover:bg-hover",
      )}
    >
      {item.icon && (
        <Icon
          name={item.icon}
          size={16}
          className={active ? "text-accent" : "text-faint"}
        />
      )}
      <span className="flex-1 truncate">{item.label}</span>
      {item.status && <StatusDot status={item.status} size={6} halo={false} />}
      {item.count != null && (
        <span className="sl-num text-11 text-muted">{item.count}</span>
      )}
    </button>
  );
}
