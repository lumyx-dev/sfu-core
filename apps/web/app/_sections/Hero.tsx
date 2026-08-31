import Link from 'next/link';
import { Button } from '@lumyx/ui';
import { SiteHeader } from '@/components/chrome/SiteHeader';
import { Spotlight } from '@/components/motion/Spotlight';
import { GITHUB_URL } from '@/content/nav';
import { MARQUEE_ITEMS } from '@/content/home';
import { SnippetTabs } from './SnippetTabs';

// Source: Home.dc.html:41-111 (the `.theme-dark[data-hero]` container, `section#top` through
// the marquee strip that closes it).
export function Hero() {
  return (
    <div data-hero className="theme-dark relative overflow-hidden bg-page text-body">
      {/* Dot grid of the hero, masked to the top-left. Decorative — the only imagery on the
          site besides the spotlight. The mask uses only its alpha channel, so the opaque
          stop's hue is irrelevant — --sl-n-950 stands in for the source's literal black stop.
          Kept as inline style: the multi-stop radial-gradient()/dual vendor-prefixed
          mask-image don't have a legible Tailwind-arbitrary-value form. */}
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

      <section id="top" className="relative mx-auto max-w-[1280px] px-5 md:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-10 items-start pt-14 min-[1120px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] min-[1120px]:gap-14 min-[1120px]:pt-[84px]">
          <div className="flex flex-col gap-6">
            <span
              data-anim="slide"
              data-anim-now
              data-anim-delay="0"
              className="sl-label text-accent-text"
            >
              Open-source WebRTC infrastructure
            </span>
            <h1
              data-anim="fade"
              data-anim-now
              data-anim-delay="40"
              className="m-0 text-[40px] font-semibold tracking-[-0.035em] leading-[1.02] text-strong [text-wrap:pretty] min-[1120px]:text-[62px]"
            >
              <span data-words style={{ display: 'block' }}>
                The WebRTC SFU that tells you
              </span>
              <span data-words data-words-delay="240" style={{ display: 'block' }}>
                why the call was bad.
              </span>
            </h1>
            <p
              data-anim="rise"
              data-anim-now
              data-anim-delay="520"
              className="m-0 text-[17px] leading-[1.6] text-muted max-w-[520px] [text-wrap:pretty]"
            >
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

      {/* Marquee strip below the hero grid, still inside [data-hero] — Home.dc.html:101-110.
          Masked left/right with the same alpha-only-mask substitution as the dots above. */}
      <div
        aria-hidden
        className="relative overflow-hidden mt-14 border-t border-border-subtle pt-4 pb-[30px]"
        style={{
          maskImage: 'linear-gradient(90deg, transparent, var(--sl-n-950) 10%, var(--sl-n-950) 90%, transparent)',
          WebkitMaskImage:
            'linear-gradient(90deg, transparent, var(--sl-n-950) 10%, var(--sl-n-950) 90%, transparent)',
        }}
      >
        <div className="flex w-max animate-[sl-marquee_38s_linear_infinite]">
          {[0, 1].map((rep) =>
            MARQUEE_ITEMS.map((item, i) => (
              <span
                key={`${rep}-${item}-${i}`}
                className="sl-num inline-flex items-center gap-2.5 px-[26px] text-13 text-faint whitespace-nowrap"
              >
                {item}
                <span className="w-1 h-1 rounded-full bg-accent" />
              </span>
            )),
          )}
        </div>
      </div>
    </div>
  );
}
