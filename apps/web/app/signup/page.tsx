import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { GITHUB_URL } from '@/content/nav';
import { Wordmark } from '@/components/chrome/Wordmark';
import { Spotlight } from '@/components/motion/Spotlight';
import { SellingPoints } from './_sections/SellingPoints';
import { SignupWizard } from './_sections/SignupWizard';

export const metadata: Metadata = {
  title: 'Sign up — Sightline',
  description: 'Create a project, pick a region and get your keys — no card, no sales call.',
};

// `--signup-spotlight-tint` is this page's own derivation (task-12-brief.md correction 2): the
// shared `--spotlight-tint` token (globals.css) is 22%, this page's spotlight is 20%, so a
// page-local custom property lives here instead of touching the token four other pages read.
const heroStyle = {
  '--signup-spotlight-tint': 'color-mix(in srgb, var(--sl-accent) 20%, transparent)',
} as CSSProperties;

// Source: Sign up.dc.html. Verified by counting the raw `<div>` nesting depth: line 30 opens
// the outer `display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr)` split; line 32
// opens `.theme-dark[data-hero]` at depth 2 and it closes at line 61 (back to depth 1, the
// outer grid); line 63 then opens a SIBLING div, back to depth 2, with
// `background:var(--surface-card)` and no theme class. So `.theme-dark` wraps only the LEFT
// column — wordmark, headline, lead, selling points, GitHub link — and the wizard column on the
// right renders in the site's default (light) theme. task-12-brief.md's correction 1 reads
// "the ENTIRE page is one dark block ... everything lives inside it ... no light section
// anywhere," which this nesting does not support; flagged as a divergence in the task report.
// What correction 1 gets right and this page follows: there is no separate light "body" BELOW
// a dark hero (the pattern Pricing and Home use) — the dark portion is a full-height side
// column, not a top slice, and the page carries neither SiteHeader nor SiteFooter (correction 3)
// nor any `data-anim` (correction 5).
export default function SignupPage() {
  return (
    // Source: Sign up.dc.html:30 — the outer split. Stacked on narrow viewports (the source is
    // a fixed 1440px mockup with no responsive behaviour) — same treatment as Pricing's
    // PricingHero.tsx grid.
    <div className="grid grid-cols-[minmax(0,1fr)] min-h-screen min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div
        data-hero
        className="theme-dark relative overflow-hidden flex flex-col bg-page text-body"
        style={heroStyle}
      >
        {/* Sign up.dc.html:33 — `120% 80% at 20% 0%` with a 26%/76% stop pair: different values
            from every other hero's dot grid (`130% 78% at 26% 0%` with a 26%/74% stop pair) —
            do not copy those values here. Same alpha-only-mask substitution as Home's Hero.tsx,
            Pricing's PricingHero.tsx and Compare's CompareHero.tsx. */}
        <span
          aria-hidden
          className="absolute inset-0 opacity-50 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(var(--sl-n-700) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(120% 80% at 20% 0%, var(--sl-n-950) 26%, transparent 76%)',
            WebkitMaskImage:
              'radial-gradient(120% 80% at 20% 0%, var(--sl-n-950) 26%, transparent 76%)',
          }}
        />
        <Spotlight size={420} tint="var(--signup-spotlight-tint)" />

        {/* Sign up.dc.html:36 — `padding:32px 44px 0`. Horizontal padding reduced below 640px
            (this task's own responsive floor) so the body never scrolls horizontally. */}
        <div className="relative px-5 pt-8 sm:px-11">
          <Link href="/" aria-label="Sightline — home">
            <Wordmark />
          </Link>
        </div>

        {/* Sign up.dc.html:43 — `padding:56px 44px;gap:28px;justify-content:center`. */}
        <div className="relative flex flex-1 flex-col px-5 py-10 gap-6 justify-center sm:px-11 sm:py-14 sm:gap-7">
          {/* Sign up.dc.html:44 — 40px/600/-0.03em/lh 1.08, max-width 460px. The 32px floor
              below 640px is this task's own responsive choice. */}
          <h1 className="m-0 text-[32px] font-semibold tracking-[-0.03em] leading-[1.08] text-strong max-w-[460px] [text-wrap:pretty] sm:text-[40px]">
            Ten thousand participant-minutes a month, no card.
          </h1>
          {/* Sign up.dc.html:45 — 15px/1.6, max-width 440px. */}
          <p className="m-0 text-[15px] leading-body text-muted max-w-[440px] [text-wrap:pretty]">
            One project, one region, a pair of keys. The dashboard fills up the moment your first
            peer joins.
          </p>

          <SellingPoints />

          {/* Sign up.dc.html:56 — `gap:12px;padding-top:4px`. */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="sl-num text-[12.5px] text-faint">Or self-host it, free forever —</span>
            <a href={GITHUB_URL} className="text-[12.5px] font-medium">
              read the source on GitHub →
            </a>
          </div>
        </div>
      </div>

      {/* Sign up.dc.html:63 — the right column, no `.theme-dark` on it: it renders in the
          site's default (light) theme, not the dark one (see the file comment above for the
          DOM-nesting proof). `padding:44px;justify-content:center`. */}
      <div className="flex flex-col justify-center px-5 py-6 bg-card sm:p-11">
        <SignupWizard />
      </div>
    </div>
  );
}
