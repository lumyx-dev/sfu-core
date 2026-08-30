import Link from 'next/link';
import { Button } from '@sightline/ui';
import s from './FinalCta.module.css';

// Source: Compare LiveKit.dc.html:192-199. The second button is `variant="ghost"` in the
// source; @sightline/ui only exposes 'primary' | 'secondary' | 'quiet' | 'danger' | 'accentQuiet'
// (no 'ghost') — same gap Pricing's FinalCta.tsx already documents — `quiet` is the closest match.
export function FinalCta() {
  return (
    <section style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className={s.layout}>
        <h2 data-anim="rise" className={s.headline}>
          Point one staging environment at Sightline and watch a bad call explain itself.
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/signup">
            <Button variant="primary" size="lg">
              Get started free
            </Button>
          </Link>
          <Link href="/docs">
            <Button variant="quiet" size="lg">
              Read the docs
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
