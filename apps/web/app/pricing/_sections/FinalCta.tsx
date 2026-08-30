import Link from 'next/link';
import { Button } from '@sightline/ui';
import s from './FinalCta.module.css';

// Source: Pricing.dc.html:177-184. The second button is `variant="ghost"` in the source;
// @sightline/ui only exposes 'primary' | 'secondary' | 'quiet' | 'danger' | 'accentQuiet' (no
// 'ghost') — same gap already flagged in Home's app/_sections/FinalCta.tsx, `quiet` is the
// closest match. Not fixed here; packages/ui is out of scope for this task.
export function FinalCta() {
  return (
    <section style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className={s.layout}>
        <h2 className={s.headline}>
          Start on the free tier. Move to self-hosted whenever you want.
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/signup">
            <Button variant="primary" size="lg">
              Get started free
            </Button>
          </Link>
          {/* Source renders this as a bare button with no href (Pricing.dc.html:183) — there is
              no "contact" route anywhere in this codebase's content files to link it to, same
              situation Home's PricingStrip.tsx already documents for its own "Talk to us"
              button, so this stays a non-navigating button rather than a fabricated destination. */}
          <Button variant="quiet" size="lg">
            Talk to us about Business
          </Button>
        </div>
      </div>
    </section>
  );
}
