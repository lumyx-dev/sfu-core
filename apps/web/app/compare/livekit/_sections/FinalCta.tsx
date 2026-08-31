import Link from 'next/link';
import { Button } from '@lumyx/ui';

// Source: Compare LiveKit.dc.html:192-199. The second button is `variant="ghost"` in the
// source; @lumyx/ui only exposes 'primary' | 'secondary' | 'quiet' | 'danger' | 'accentQuiet'
// (no 'ghost') — same gap Pricing's FinalCta.tsx already documents — `quiet` is the closest match.
//
// This section's own border-top was removed (task-13): it's the first child of the wrapper in
// app/compare/livekit/page.tsx, which already carries `border-top: var(--border)` — the two
// hairlines doubled up and didn't quite match. Copied from Pricing without checking the
// composition matched.
//
// Source: Compare LiveKit.dc.html:192-199 — inside the closing theme-dark wrapper that also
// holds SiteFooter (task-9-brief.md correction 5). Same pattern as Pricing's own FinalCta,
// sized to this page's own 44px/-0.035em/lh1.06, max-width 760px headline (correction 5's exact
// figures).
export function FinalCta() {
  return (
    <section>
      <div className="max-w-[1280px] mx-auto py-14 px-5 sm:px-10 md:py-20 flex flex-col gap-5 items-start">
        <h2
          data-anim="rise"
          className="m-0 text-[32px] font-semibold tracking-[-0.035em] leading-[1.06] text-strong max-w-[760px] [text-wrap:pretty] sm:text-[44px]"
        >
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
