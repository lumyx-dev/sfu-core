import Link from 'next/link';
import { Button } from '@sightline/ui';
import { HEADER_NAV, SITE_VERSION, GITHUB_URL } from '@/content/nav';
import { Wordmark } from './Wordmark';
import s from './SiteHeader.module.css';

export function SiteHeader({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <header
      className={theme === 'dark' ? 'theme-dark' : undefined}
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-8 px-5 md:px-6 lg:px-10">
        <Link href="/" aria-label="Sightline — home">
          <Wordmark />
        </Link>
        <nav className="hidden flex-1 items-center gap-6 md:flex">
          {HEADER_NAV.map((l) => (
            <Link key={l.href} href={l.href} className={s.link}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <span className={`sl-num hidden md:inline ${s.meta}`}>{SITE_VERSION}</span>
          <a href={GITHUB_URL} className={s.ghostButton} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <Link href="/signup">
            <Button variant="primary" size="sm">
              Get started free
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
