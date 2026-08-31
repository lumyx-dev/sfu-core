"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { StatusDot } from "./status-dot";

export type NavSection = { label: string; items: { href: string; label: string; icon: React.ElementType }[] };

export function Wordmark({ className }: { className?: string }) {
  // No logo in the source repo — the brand is the word, Geist 600 at −0.02em,
  // next to the 6px indigo square used across the marketing site.
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="size-5 shrink-0 rounded-[6px] bg-accent" />
      <span className="text-16 font-semibold tracking-[-0.02em] text-strong">Sightline</span>
    </span>
  );
}

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

/** Sticky toolbar on the card surface. */
export function Toolbar({ title, meta, actions }: { title: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-hairline bg-card px-8 py-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-20 font-semibold text-strong">{title}</h1>
        {meta ? <div className="text-12 text-muted">{meta}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Pinned at the bottom with live counters. */
export function StatusStrip({ items }: { items: { label: string; value: string; live?: boolean }[] }) {
  return (
    <footer className="sticky bottom-0 z-20 flex items-center gap-6 border-t border-hairline bg-card px-8 py-2.5">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-2">
          {it.live ? <StatusDot status="live" /> : null}
          <span className="sl-label">{it.label}</span>
          <span className="sl-num text-12 font-medium text-strong">{it.value}</span>
        </span>
      ))}
    </footer>
  );
}

export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <main className={cn("sl-scroll mx-auto w-full max-w-[1360px] px-8 py-6", className)}>{children}</main>;
}
