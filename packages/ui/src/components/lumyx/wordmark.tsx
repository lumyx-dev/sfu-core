import * as React from "react";
import { cn } from "../../lib/utils";
import { LumyxMark } from "./mark";

export function Wordmark({ className }: { className?: string }) {
  // The mark takes the accent from `currentColor`; the word is Geist 600 at −0.02em.
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LumyxMark size={20} className="text-accent" />
      <span className="text-16 font-semibold tracking-[-0.02em] text-strong">Lumyx</span>
    </span>
  );
}
