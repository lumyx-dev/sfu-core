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
export function DocsHeader() {
  return (
    <header className={s.header}>
      <Link href="/" aria-label="Sightline — home" className={s.brand}>
        <Wordmark />
      </Link>
      <Badge tone="neutral">Docs</Badge>
      <nav className={s.nav}>
        {NAV.map((l) => (
          <Link key={l.href} href={l.href} className={s.link}>
            {l.label}
          </Link>
        ))}
      </nav>
      <span className={s.spacer} />
      <span className={s.search}>
        <Input size="sm" placeholder="Search the docs" wrapperStyle={{ width: 240 }} />
      </span>
      <span className={s.version}>
        <Select size="sm" options={VERSIONS} defaultValue="v0.4.1" wrapperStyle={{ width: 110 }} />
      </span>
      <a href={GITHUB_URL} className={s.ghostButton} target="_blank" rel="noreferrer">
        GitHub
      </a>
    </header>
  );
}
