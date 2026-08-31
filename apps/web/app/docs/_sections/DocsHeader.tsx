import Link from 'next/link';
import { Badge, Input, Select } from '@lumyx/ui';
import { GITHUB_URL } from '@/content/nav';
import { Wordmark } from '@/components/chrome/Wordmark';
import s from './DocsHeader.module.css';

const VERSIONS = ['v0.4.1', 'v0.3.8', 'main'];

const NAV = [
  { label: 'Product', href: '/' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'vs LiveKit', href: '/compare/livekit' },
  { label: 'Changelog', href: '/changelog' },
];

// Source: Docs.dc.html:32-49. This page's own 60px chrome, not the shared SiteHeader
// (task-10-brief.md correction 3) — a Badge "Docs", a four-link nav, a search Input, a version
// Select defaulting to v0.4.1, and a bordered GitHub link, in that order.
//
// Responsive (review round 3, finding A): hiding the nav and search together at 900px closed
// the 681-900px band from round 2, but left everything visible again above 900px, and the
// arithmetic there doesn't fit either — wordmark (~103) + badge (~42) + the four-link nav
// (~293) + search (240 fixed) + version (110 fixed) + GitHub (~67) + six 26px gaps (156) + 48px
// padding comes to roughly 1010-1060px against a 901px viewport. Two changes close this for
// good instead of relocating it again: the nav/search hide breakpoint moves up to 1100px (~40px
// of slack over the ~1059px worst case), and search/version stop being `flex: none` over a hard
// pixel width — they're `flex-initial` (can shrink, won't grow) with `width:100%;max-width` on
// the Input/Select itself, so even if that estimate is off, they compress instead of
// overflowing rather than needing a fourth breakpoint guess.
export function DocsHeader() {
  return (
    <header className={`flex items-center h-[60px] flex-none ${s.header}`}>
      <Link href="/" aria-label="Sightline — home" className="flex items-center flex-none">
        <Wordmark />
      </Link>
      <Badge tone="neutral">Docs</Badge>
      <nav className={`items-center gap-[22px] ${s.nav}`}>
        {NAV.map((l) => (
          <Link key={l.href} href={l.href} className={`no-underline ${s.link}`}>
            {l.label}
          </Link>
        ))}
      </nav>
      <span className="flex-1" />
      <span className={`flex-initial min-w-0 ${s.search}`}>
        <Input
          size="sm"
          placeholder="Search the docs"
          wrapperClassName="w-full max-w-[240px]"
        />
      </span>
      <span className={`flex-initial min-w-0 ${s.version}`}>
        <Select
          size="sm"
          options={VERSIONS}
          defaultValue="v0.4.1"
          wrapperClassName="w-full max-w-[110px]"
        />
      </span>
      <a
        href={GITHUB_URL}
        className={`inline-flex items-center h-8 px-3 no-underline flex-none ${s.ghostButton}`}
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>
    </header>
  );
}
