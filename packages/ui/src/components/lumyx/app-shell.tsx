"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from '../../lib/utils';
import { Wordmark } from "./wordmark";
import type { NavSection } from "./sidebar-nav";

/** Sidebar 248px + an `auto 1fr auto` content column. Nothing is centred. */
export function AppShell({
  sections, footer, children,
}: { sections: NavSection[]; footer?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="grid min-h-screen grid-cols-[248px_1fr] bg-page">
      <aside className="sl-scroll sticky top-0 flex h-screen flex-col gap-6 overflow-y-auto border-r border-hairline bg-card px-3 py-4">
        <Link href="/" className="px-2 no-underline hover:no-underline"><Wordmark /></Link>
        <nav className="flex flex-col gap-5">
          {sections.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="sl-label px-2 pb-1">{s.label}</span>
              {s.items.map((it) => {
                const active = pathname === it.href;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-13 no-underline transition-colors duration-[120ms]",
                      active
                        ? "bg-accent-tint text-accent-text font-medium shadow-[inset_2px_0_0_var(--accent)] hover:no-underline"
                        : "text-body hover:bg-hover hover:text-strong hover:no-underline"
                    )}
                  >
                    <it.icon className="size-4 shrink-0 stroke-[1.75]" />
                    {it.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        {footer ? <div className="mt-auto px-2">{footer}</div> : null}
      </aside>
      <div className="grid grid-rows-[auto_1fr_auto]">{children}</div>
    </div>
  );
}
