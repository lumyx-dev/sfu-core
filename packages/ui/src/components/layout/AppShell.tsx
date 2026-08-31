import type { CSSProperties, ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface AppShellProps {
  /** A `<Sidebar />`. Fixed width, full height, its own scroll. */
  sidebar?: ReactNode;
  /** A `<Toolbar />`. Pinned above the scrolling content. */
  toolbar?: ReactNode;
  /** A `<StatusStrip />`. Pinned to the bottom with live counters. */
  footer?: ReactNode;
  children?: ReactNode;
  /**
   * Centres and caps the content column. The house maximum is 1360px —
   * pass `"var(--sl-content-max)"` or omit to fill.
   */
  maxWidth?: string | number;
  /** Light is the default; `"dark"` scopes `.theme-dark` to the whole shell. */
  theme?: "light" | "dark";
  className?: string;
}

/**
 * Sidebar + an `auto 1fr auto` content column. Content starts top-left and
 * fills down — nothing is centred in a hero.
 */
export function AppShell({
  sidebar,
  toolbar,
  footer,
  children,
  maxWidth,
  theme,
  className,
}: AppShellProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-full overflow-hidden bg-page font-sans text-body",
        theme === "dark" && "theme-dark",
        className,
      )}
    >
      {sidebar}
      <div className="grid min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto]">
        {toolbar}
        <main className="sl-scroll min-h-0 overflow-y-auto">
          <div
            style={{ maxWidth } as CSSProperties}
            className={cn("w-full p-6", maxWidth && "mx-auto")}
          >
            {children}
          </div>
        </main>
        {footer}
      </div>
    </div>
  );
}
