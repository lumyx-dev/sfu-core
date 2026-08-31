import Link from 'next/link';
import { Button } from '@lumyx/ui';

// Source: Pricing.dc.html:177-184. The second button is `variant="ghost"` in the source;
// @lumyx/ui only exposes 'primary' | 'secondary' | 'quiet' | 'danger' | 'accentQuiet' (no
// 'ghost') — same gap already flagged in Home's app/_sections/FinalCta.tsx, `quiet` is the
// closest match. Not fixed here; packages/ui is out of scope for this task.
// This section's own border-top was removed (task-13): it's the first child of the wrapper
// in app/pricing/page.tsx, which already carries `border-top: var(--border)` — the two hairlines
// doubled up and didn't quite match.
//
// Source: Pricing.dc.html:177-184 — inside the closing `.theme-dark` wrapper (task-8-brief.md
// correction 8). Distinct copy and size from Home's app/_sections/FinalCta.tsx (40px here vs
// 34/52px there), so this is its own file rather than a shared one.
export function FinalCta() {
  return (
    <section>
      <div className="max-w-[1280px] mx-auto px-5 py-14 flex flex-col gap-5 items-start sm:px-10 md:py-[72px]">
        <h2 className="m-0 text-[30px] font-semibold tracking-[-0.035em] leading-[1.06] text-strong max-w-[700px] [text-wrap:pretty] sm:text-[40px]">
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
