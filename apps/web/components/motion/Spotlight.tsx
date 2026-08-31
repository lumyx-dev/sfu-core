'use client';

import { useEffect, useRef } from 'react';

export interface SpotlightProps {
  /** Circle diameter in px. Defaults to the 460px every hero but Signup uses. */
  size?: number;
  /** CSS colour value (a `var(--*)` reference). Defaults to the shared `--spotlight-tint` token. */
  tint?: string;
}

// `size`/`tint` are optional so every existing call site (Home's Hero, Pricing's PricingHero,
// Compare's CompareHero) keeps its exact prior behaviour untouched. Signup is the first page
// whose spotlight differs from the shared default (420px/20% vs. 460px/22%, task-12-brief.md
// correction 2) — passing props here avoids forking this component or touching the shared
// `--spotlight-tint` token that the other three pages depend on.
export function Spotlight({ size = 460, tint = 'var(--spotlight-tint)' }: SpotlightProps = {}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const hero = el?.closest<HTMLElement>('[data-hero]');
    if (!el || !hero) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      el.style.background = `radial-gradient(${size}px circle at ${e.clientX - r.left}px ${
        e.clientY - r.top
      }px, ${tint}, transparent 68%)`;
      el.style.opacity = '1';
    };
    const onLeave = () => {
      el.style.opacity = '0';
    };

    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    return () => {
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
    };
  }, [size, tint]);

  return (
    <div
      ref={ref}
      aria-hidden
      data-spotlight
      className="absolute inset-0 pointer-events-none transition-opacity duration-300 ease-out"
      style={{ opacity: 0 }}
    />
  );
}
