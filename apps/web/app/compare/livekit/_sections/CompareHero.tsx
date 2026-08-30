import Link from 'next/link';
import { Button } from '@sightline/ui';
import { SiteHeader } from '@/components/chrome/SiteHeader';
import { Spotlight } from '@/components/motion/Spotlight';
import s from './CompareHero.module.css';

// Source: Compare LiveKit.dc.html:35-68 (the `.theme-dark[data-hero]` container through the CTA
// row). Dark hero identical in pattern to Home's `app/_sections/Hero.tsx` and Pricing's
// `PricingHero.tsx` — dot grid + Spotlight island + SiteHeader theme="dark" — but this hero is a
// flex column (task-9-brief.md correction 3), not the two-column grid the other two pages use.
export function CompareHero() {
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
        <div className={s.content}>
          <span
            data-anim="slide"
            data-anim-now
            className="sl-label"
            style={{ color: 'var(--accent-text)' }}
          >
            Comparison
          </span>
          <h1 data-anim="rise" data-anim-now data-anim-delay="60" className={s.title}>
            Sightline vs LiveKit: same signaling, different priorities.
          </h1>
          <p data-anim="rise" data-anim-now data-anim-delay="140" className={s.lead}>
            LiveKit is a mature, well-engineered platform, and it moved its roadmap toward AI
            voice agents. If you are shipping human-to-human video and you keep asking
            &ldquo;why was that call bad?&rdquo;, the trade-offs below are the ones that matter.
          </p>
          <div
            data-anim="fade"
            data-anim-now
            data-anim-delay="220"
            className="flex flex-wrap items-center gap-3 pt-1"
          >
            <Link href="/signup">
              <Button variant="primary" size="lg">
                Get started free
              </Button>
            </Link>
            <a href="#migrate" className={s.migrateLink}>
              Read the migration steps
            </a>
            <span className={`sl-num ${s.meta}`}>Corrections welcome as a PR</span>
          </div>
        </div>
      </section>
    </div>
  );
}
