import Link from 'next/link';
import { Badge, Input, Select } from '@sightline/ui';
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
// Responsive: the nav and the search Input now hide at the SAME breakpoint (900px), not two
// staggered ones. A prior version hid the nav at 900px and the search at 680px, which left an
// unshrinkable 681-900px band — the exact width of a 768px tablet — where 240px (search) +
// 110px (version) + wordmark + badge + GitHub + five 26px gaps + 48px padding (~750-780px) no
// longer fit and forced the body into horizontal scroll. Hiding both together removes that
// band; the version Select (110px) alone never gets close to overflowing down to 521px.
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
      <span className={`flex-none ${s.search}`}>
        <Input size="sm" placeholder="Search the docs" wrapperStyle={{ width: 240 }} />
      </span>
      <span className={`flex-none ${s.version}`}>
        <Select size="sm" options={VERSIONS} defaultValue="v0.4.1" wrapperStyle={{ width: 110 }} />
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
