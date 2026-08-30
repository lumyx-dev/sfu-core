'use client';
// Seul composant client du design system : autoScroll a besoin d'une ref et d'un effet.
// Cf. docs/superpowers/specs/2026-08-29-sightline-design-system-design.md §5.

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '../../../lib/cn';
import s from './EventList.module.css';

export type EventListEntryType = 'info' | 'event' | 'send' | 'error' | 'muted';

export interface EventListEntry {
  id?: string | number;
  time?: string;
  message?: string;
  detail?: string;
  type?: EventListEntryType;
}

export interface EventListProps {
  entries?: EventListEntry[];
  height?: number;
  autoScroll?: boolean;
  dense?: boolean;
  style?: CSSProperties;
}

/* Source :683-728. entries a la forme { time, message, detail?, type? } — la source
   utilise "message", pas "label" comme l'indiquait le brief (divergence, voir rapport).
   Rendu : fait accompli, sentence case, identifiant en detail terminal
   ("Peer joined · c27ad930"). */
export function EventList({
  entries = [],
  height,
  autoScroll = false,
  dense = false,
  style,
}: EventListProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries, autoScroll]);

  return (
    <div
      ref={ref}
      className={cn('sl-scroll', s.wrap, dense && s.dense)}
      style={{ height, overflowY: height ? 'auto' : 'visible', ...style }}
    >
      {entries.map((e, i) => (
        <div key={e.id ?? i} className={s.row}>
          <span className={cn('sl-num', s.time)}>{e.time}</span>
          <span className={cn(s.msg, s[e.type ?? 'info'] || s.info)}>
            {e.message}
            {e.detail && (
              <span className={s.detail}>
                {' · '}
                {e.detail}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
