import Link from 'next/link';
import { Button } from '@sightline/ui';
import { SiteHeader } from '@/components/chrome/SiteHeader';
import { Spotlight } from '@/components/motion/Spotlight';
import { GITHUB_URL } from '@/content/nav';
import { SnippetTabs } from './SnippetTabs';
import s from './Hero.module.css';

// Source: Home.dc.html:41-98 (the `.theme-dark[data-hero]` container through the end of
// `section#top`). The marquee strip that follows it in the source (:101-110, a decorative
// ticker of metric names) is not part of this task's brief and is left out — see
// task-6-report.md.
export function Hero() {
  return (
    <div data-hero className="theme-dark relative overflow-hidden" style={{ background: 'var(--surface-page)', color: 'var(--text-body)' }}>
      <span aria-hidden className={s.dots} />
      <Spotlight />

      <SiteHeader theme="dark" />

      <section id="top" className="relative mx-auto max-w-[1280px] px-5 md:px-6 lg:px-10">
        <div className={s.grid}>
          <div className="flex flex-col gap-6">
            <span
              data-anim="slide"
              data-anim-now
              data-anim-delay="0"
              className="sl-label"
              style={{ color: 'var(--accent-text)' }}
            >
              Open-source WebRTC infrastructure
            </span>
            <h1 data-anim="fade" data-anim-now data-anim-delay="40" className={s.title}>
              <span data-words style={{ display: 'block' }}>
                The WebRTC SFU that tells you
              </span>
              <span data-words data-words-delay="240" style={{ display: 'block' }}>
                why the call was bad.
              </span>
            </h1>
            <p data-anim="rise" data-anim-now data-anim-delay="520" className={s.lead}>
              A Rust SFU for teams shipping real video products — not AI voice agents. Selective
              forwarding, and observability in the media path: jitter, packet loss, RTT, NACK
              ratio, per peer, per room, live.
            </p>
            <div
              data-anim="rise"
              data-anim-now
              data-anim-delay="600"
              className="flex flex-wrap items-center gap-3"
            >
              <Link href="/signup">
                <Button variant="primary" size="lg">
                  Get started free
                </Button>
              </Link>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="lg">
                  View on GitHub
                </Button>
              </a>
            </div>
          </div>

          <div data-anim="rise" data-anim-now data-anim-delay="320" className="flex flex-col gap-3">
            <SnippetTabs />
          </div>
        </div>
      </section>
    </div>
  );
}
