import Link from 'next/link';
import { GITHUB_URL } from '@/content/nav';
import { Wordmark } from '@/components/chrome/Wordmark';
import s from './ChangelogHero.module.css';

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
      <header style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className={`flex h-16 items-center px-5 md:px-6 lg:px-10 ${s.headerInner}`}>
          <Link href="/" aria-label="Sightline — home" className="flex flex-none items-center">
            <Wordmark />
          </Link>
          <nav className="hidden flex-1 items-center gap-6 md:flex">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className={s.navLink}>
                {l.label}
              </Link>
            ))}
            <span className={s.navLinkActive}>Changelog</span>
          </nav>
          <div className="ml-auto flex items-center md:ml-0">
            <a href={GITHUB_URL} className={s.ghostLink} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </header>

      <section className={`flex flex-col pt-16 pb-12 px-5 md:px-6 lg:px-10 ${s.hero}`}>
        <span className="sl-label" style={{ color: 'var(--accent-text)' }}>
          Changelog
        </span>
        <h1 className={s.title}>Every release, with the commit that shipped it.</h1>
        <p className={s.lead}>
          Sightline follows semantic versioning. Breaking changes only land on a minor bump
          while the project is pre-1.0, and each one is called out explicitly.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <a href="#" className={s.subscribeLink}>
            Subscribe to the RSS feed
          </a>
          <a href={`${GITHUB_URL}/releases`} className={s.releasesLink}>
            GitHub releases →
          </a>
        </div>
      </section>
    </div>
  );
}
