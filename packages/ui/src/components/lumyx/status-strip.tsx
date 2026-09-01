import * as React from "react";
import { StatusDot } from "./status-dot";

/** Ligne 3 de la grille du SidebarInset — l'etat du systeme, pas celui de l'ecran. */
export function StatusStrip({ items }: { items: { label: string; value: string; live?: boolean }[] }) {
  return (
    <footer className="row-start-3 border-t border-hairline bg-card">
      <div className="sl-scroll mx-auto flex w-full max-w-[1360px] items-center gap-6 overflow-x-auto px-4 py-2.5 lg:px-8">
        {items.map((it) => (
          <span key={it.label} className="flex shrink-0 items-center gap-2">
            {it.live ? <StatusDot status="live" /> : null}
            <span className="sl-label">{it.label}</span>
            <span className="sl-num text-12 font-medium text-strong">{it.value}</span>
          </span>
        ))}
      </div>
    </footer>
  );
}
