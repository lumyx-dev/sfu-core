import Link from 'next/link';
import { Button } from '@lumyx/ui';
import { SiteHeader } from '@/components/chrome/SiteHeader';
import { Spotlight } from '@/components/motion/Spotlight';

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
      {/* Same dot-grid mask treatment (26%/74% stops) as Home's Hero and Pricing's PricingHero,
          reused verbatim: the mask uses only its alpha channel, so var(--n-950) stands in for
          the source's literal black stop. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(var(--n-700)_1px,transparent_1px)] bg-[length:24px_24px] [mask-image:radial-gradient(130%_78%_at_26%_0%,var(--n-950)_26%,transparent_74%)] [-webkit-mask-image:radial-gradient(130%_78%_at_26%_0%,var(--n-950)_26%,transparent_74%)]"
      />
      <Spotlight />

      <SiteHeader theme="dark" />

      <section className="relative mx-auto max-w-[1280px] px-5 md:px-6 lg:px-10">
        {/* Compare LiveKit.dc.html:58 — padding:72px 40px 56px on a column flex, gap 22px.
            Horizontal padding lives on the section wrapper above. Mobile floor is this task's
            own responsive choice — the source is a fixed 1280px mockup with no narrower
            breakpoint. */}
        <div className="flex flex-col gap-[22px] pt-11 pb-8 sm:pt-[72px] sm:pb-14">
          <span
            data-anim="slide"
            data-anim-now
            className="sl-label"
            style={{ color: 'var(--accent-text)' }}
          >
            Comparison
          </span>
          {/* Compare LiveKit.dc.html:60 — 56px/600/-0.035em/lh 1.03, max-width 900px. */}
          <h1
            data-anim="rise"
            data-anim-now
            data-anim-delay="60"
            className="m-0 text-[38px] font-semibold tracking-[-0.035em] leading-[1.03] text-strong max-w-[900px] [text-wrap:pretty] sm:text-[56px]"
          >
            Sightline vs LiveKit: same signaling, different priorities.
          </h1>
          <p
            data-anim="rise"
            data-anim-now
            data-anim-delay="140"
            className="m-0 text-base leading-body text-muted max-w-[660px] [text-wrap:pretty]"
          >
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
            {/* Compare LiveKit.dc.html:64 — in-page anchor to #migrate, styled as its own
                bordered pill rather than a Button variant (the border colour, height and radius
                don't match any exposed Button variant — same treatment as SiteHeader's ghost
                GitHub link). */}
            <a
              href="#migrate"
              className="inline-flex items-center h-10 px-[18px] border border-border-strong rounded-control text-strong text-[13.5px] font-medium no-underline"
            >
              Read the migration steps
            </a>
            <span className="sl-num text-[12.5px] text-faint">Corrections welcome as a PR</span>
          </div>
        </div>
      </section>
    </div>
  );
}
