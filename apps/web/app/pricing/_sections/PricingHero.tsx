import { SiteHeader } from '@/components/chrome/SiteHeader';
import { Spotlight } from '@/components/motion/Spotlight';
import { CostEstimator } from './CostEstimator';

// Source: Pricing.dc.html:35-63. Dark hero identical in pattern to Home's `app/_sections/Hero.tsx`
// (dot grid + Spotlight island + SiteHeader theme="dark"), but its content section is a
// two-column grid whose right column IS the cost estimator (task-8-brief.md correction 2) — not
// a standalone section further down the page.
export function PricingHero() {
  return (
    <div data-hero className="theme-dark relative overflow-hidden bg-page text-body">
      {/* Same dot-grid mask treatment as Home's Hero.tsx: the mask uses only its alpha channel,
          so --sl-n-950 stands in for the source's literal black stop. Kept as inline style: the
          multi-stop radial-gradient()/dual vendor-prefixed mask-image don't have a legible
          Tailwind-arbitrary-value form. */}
      <span
        aria-hidden
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(var(--sl-n-700) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(130% 78% at 26% 0%, var(--sl-n-950) 26%, transparent 74%)',
          WebkitMaskImage:
            'radial-gradient(130% 78% at 26% 0%, var(--sl-n-950) 26%, transparent 74%)',
        }}
      />
      <Spotlight />

      <SiteHeader theme="dark" />

      <section className="relative mx-auto max-w-[1280px] px-5 md:px-6 lg:px-10">
        {/* Pricing.dc.html:58 — `grid-template-columns:minmax(0,1fr) minmax(0,420px)`. Stacked
            on narrow viewports (the source is a fixed 1280px mockup with no responsive
            behaviour). */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 items-start pt-14 pb-10 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,420px)] min-[900px]:gap-14 min-[900px]:items-end min-[900px]:pt-[72px] min-[900px]:pb-14">
          <div className="flex flex-col gap-5">
            <span data-anim="slide" data-anim-now className="sl-label text-accent-text">
              Pricing
            </span>
            {/* Source fixes this at 54px (Pricing.dc.html:60) with no mobile variant — the 38px
                floor below 640px is this task's own responsive choice, same treatment as Home's
                Hero.tsx title. */}
            <h1
              data-anim="rise"
              data-anim-now
              data-anim-delay="60"
              className="m-0 text-[38px] font-semibold tracking-[-0.035em] leading-[1.04] text-strong [text-wrap:pretty] sm:text-[54px]"
            >
              You only pay for minutes you didn&rsquo;t want to operate yourself.
            </h1>
            <p
              data-anim="rise"
              data-anim-now
              data-anim-delay="140"
              className="m-0 text-16 text-muted max-w-[540px] [text-wrap:pretty]"
            >
              Self-hosting is free and unmetered — it always will be. Cloud is billed per
              participant-minute, with egress included up to each plan&rsquo;s cap and a spend
              cap you set yourself.
            </p>
          </div>

          <CostEstimator />
        </div>
      </section>
    </div>
  );
}
