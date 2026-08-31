import Link from 'next/link';
import { GITHUB_URL } from '@/content/nav';
import { Wordmark } from '@/components/chrome/Wordmark';

// Source: Changelog.dc.html:32-60. Unlike Home, Pricing and Compare, this page has no
// `data-hero`, no dot-grid layer and no Spotlight — a plain `.theme-dark` block wrapping a 64px
// header and the hero (task-11-brief.md correction 2). The header is page-local rather than the
// shared `SiteHeader`: this page's content column is 1080px wide throughout (correction 3), and
// `SiteHeader` hardcodes 1280px, which would misalign the header against the hero/main below it.
// Its nav is also literally different from `content/nav.ts`'s HEADER_NAV (no "Observability",
// includes "Changelog" itself as the active item) — matching what every other page's own source
// file renders for its own header (each highlights its own current page).
const NAV = [
  { label: 'Why Sightline', href: '/#why' },
  { label: 'vs LiveKit', href: '/compare/livekit' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
];

export function ChangelogHero() {
  return (
    <div className="theme-dark" style={{ background: 'var(--surface-page)', color: 'var(--text-body)' }}>
      <header className="border-b border-border-subtle">
        {/* Everything on this page sits inside a 1080px column, not the 1280px every other
            marketing page uses (task-11-brief.md correction 3), so this header can't reuse
            components/chrome/SiteHeader (hardcodes max-w-[1280px]) without breaking that
            alignment. Row gap is 30px, off the Tailwind spacing scale (28/32), hence the
            arbitrary value rather than gap-8. */}
        <div className="flex h-16 items-center px-5 md:px-6 lg:px-10 max-w-[1080px] mx-auto gap-[30px]">
          <Link href="/" aria-label="Sightline — home" className="flex flex-none items-center">
            <Wordmark />
          </Link>
          <nav className="hidden flex-1 items-center gap-6 md:flex">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className="text-[12.5px] text-muted no-underline">
                {l.label}
              </Link>
            ))}
            <span className="text-[12.5px] text-strong no-underline">Changelog</span>
          </nav>
          <div className="ml-auto flex items-center md:ml-0">
            <a
              href={GITHUB_URL}
              className="inline-flex items-center h-8 px-3 border border-border rounded-control text-body text-[12.5px] no-underline"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Hero — Changelog.dc.html:51-59. */}
      <section className="flex flex-col pt-16 pb-12 px-5 md:px-6 lg:px-10 max-w-[1080px] mx-auto gap-[18px]">
        <span className="sl-label" style={{ color: 'var(--accent-text)' }}>
          Changelog
        </span>
        <h1 className="m-0 text-34 font-semibold tracking-[-0.035em] leading-[1.05] text-strong max-w-[700px] [text-wrap:pretty] sm:text-[48px]">
          Every release, with the commit that shipped it.
        </h1>
        <p className="m-0 text-[15px] leading-body text-muted max-w-[560px] [text-wrap:pretty]">
          Sightline follows semantic versioning. Breaking changes only land on a minor bump
          while the project is pre-1.0, and each one is called out explicitly.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <a
            href="#"
            className="inline-flex items-center h-[34px] px-3.5 border border-border-strong rounded-control text-strong text-[12.5px] font-medium no-underline"
          >
            Subscribe to the RSS feed
          </a>
          <a
            href={`${GITHUB_URL}/releases`}
            className="text-[12.5px] text-muted no-underline"
          >
            GitHub releases →
          </a>
        </div>
      </section>
    </div>
  );
}
