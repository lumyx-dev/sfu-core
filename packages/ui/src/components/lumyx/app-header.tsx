"use client";
import * as React from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { SidebarTrigger } from "../ui/sidebar";

export type Crumb = { href?: string; label: string };

/**
 * Ligne 1 de la grille du SidebarInset. Rendu par la page, pas par le chrome :
 * le titre vit avec les donnees qui le remplissent.
 */
export function AppHeader({
  breadcrumb,
  title,
  meta,
  actions,
  className,
}: {
  breadcrumb?: Crumb[];
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("row-start-1 border-b border-hairline bg-card", className)}>
      <div className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-6 px-4 py-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="lg:hidden" />
          <div className="flex min-w-0 flex-col gap-0.5">
            {breadcrumb?.length ? (
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-12 text-muted">
                {breadcrumb.map((crumb, i) => (
                  <React.Fragment key={`${crumb.label}-${i}`}>
                    {i > 0 ? <span aria-hidden="true" className="text-faint">/</span> : null}
                    {crumb.href ? (
                      <Link href={crumb.href} className="text-muted no-underline hover:text-strong">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current="page">{crumb.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            ) : null}
            <h1 className="truncate text-20 font-semibold text-strong">{title}</h1>
            {meta ? <div className="truncate text-12 text-muted">{meta}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
