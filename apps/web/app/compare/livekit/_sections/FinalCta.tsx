import Link from 'next/link';
import { Button } from '@lumyx/ui';
import s from './FinalCta.module.css';

// Source: Compare LiveKit.dc.html:192-199. The second button is `variant="ghost"` in the
// source; @lumyx/ui only exposes 'primary' | 'secondary' | 'quiet' | 'danger' | 'accentQuiet'
// (no 'ghost') — same gap Pricing's FinalCta.tsx already documents — `quiet` is the closest match.
//
// This section's own border-top was removed (task-13): it's the first child of the wrapper in
// app/compare/livekit/page.tsx, which already carries `border-top: var(--border)` — the two
// hairlines doubled up and didn't quite match. Copied from Pricing without checking the
// composition matched.
export function FinalCta() {
  return (
    <section>
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
