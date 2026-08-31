import { SiteHeader } from '@/components/chrome/SiteHeader';
import { Spotlight } from '@/components/motion/Spotlight';
import { CostEstimator } from './CostEstimator';
import s from './PricingHero.module.css';

// Source: Pricing.dc.html:35-63. Dark hero identical in pattern to Home's `app/_sections/Hero.tsx`
// (dot grid + Spotlight island + SiteHeader theme="dark"), but its content section is a
// two-column grid whose right column IS the cost estimator (task-8-brief.md correction 2) — not
// a standalone section further down the page.
export function PricingHero() {
  return (
    <div
      data-hero
      className="theme-dark relative overflow-hidden"
      style={{ background: 'var(--surface-page)', color: 'var(--text-body)' }}
    >
      <span aria-hidden className={s.dots} />
      <Spotlight />

      <SiteHeader theme="dark" />

      <section className="relative mx-auto max-w-[1280px] px-5 md:px-6 lg:px-10">
        <div className={s.grid}>
          <div className="flex flex-col gap-5">
            <span
              data-anim="slide"
              data-anim-now
              className="sl-label"
              style={{ color: 'var(--accent-text)' }}
            >
              Pricing
            </span>
            <h1 data-anim="rise" data-anim-now data-anim-delay="60" className={s.title}>
              You only pay for minutes you didn&rsquo;t want to operate yourself.
            </h1>
            <p data-anim="rise" data-anim-now data-anim-delay="140" className={s.lead}>
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
