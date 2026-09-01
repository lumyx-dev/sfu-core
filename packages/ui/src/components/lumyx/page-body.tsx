import * as React from "react";
import { cn } from "../../lib/utils";

/** Ligne 2 de la grille du SidebarInset — la seule zone qui scrolle. */
export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <main className="sl-scroll row-start-2 min-w-0 overflow-y-auto">
      <div className={cn("mx-auto w-full max-w-[1360px] px-4 py-6 lg:px-8", className)}>{children}</div>
    </main>
  );
}
