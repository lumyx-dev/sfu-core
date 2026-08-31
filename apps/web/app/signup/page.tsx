import type { Metadata } from 'next';
import Link from 'next/link';
import { GITHUB_URL } from '@/content/nav';
import { Wordmark } from '@/components/chrome/Wordmark';
import { Spotlight } from '@/components/motion/Spotlight';
import { SellingPoints } from './_sections/SellingPoints';
import { SignupWizard } from './_sections/SignupWizard';
import s from './page.module.css';

export const metadata: Metadata = {
  title: 'Sign up — Sightline',
  description: 'Create a project, pick a region and get your keys — no card, no sales call.',
};

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
    <div className={s.shell}>
      <div data-hero className={`theme-dark relative overflow-hidden flex flex-col ${s.hero}`}>
        <span aria-hidden className={s.dots} />
        <Spotlight size={420} tint="var(--signup-spotlight-tint)" />

        <div className={`relative ${s.brand}`}>
          <Link href="/" aria-label="Sightline — home">
            <Wordmark />
          </Link>
        </div>

        <div className={`relative flex flex-1 flex-col ${s.content}`}>
          <h1 className={s.title}>Ten thousand participant-minutes a month, no card.</h1>
          <p className={s.lead}>
            One project, one region, a pair of keys. The dashboard fills up the moment your first
            peer joins.
          </p>

          <SellingPoints />

          <div className={`flex flex-wrap items-center ${s.githubRow}`}>
            <span className={`sl-num ${s.githubLabel}`}>Or self-host it, free forever —</span>
            <a href={GITHUB_URL} className={s.githubLink}>
              read the source on GitHub →
            </a>
          </div>
        </div>
      </div>

      <div className={s.panel}>
        <SignupWizard />
      </div>
    </div>
  );
}
