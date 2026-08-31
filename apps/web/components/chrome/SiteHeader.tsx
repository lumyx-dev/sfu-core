import Link from 'next/link';
import { Button } from '@lumyx/ui';
import { HEADER_NAV, SITE_VERSION, GITHUB_URL } from '@/content/nav';
import { Wordmark } from './Wordmark';

export function SiteHeader({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <header className={`border-b border-border-subtle ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-8 px-5 md:px-6 lg:px-10">
        <Link href="/" aria-label="Sightline — home">
          <Wordmark />
        </Link>
        {/* 900px: custom breakpoint (task-13 arithmetic pass) — at Tailwind's md (768px) with
            24px side padding, the five-link nav + wordmark + version/GitHub/CTA overflows by
            ~72px; 900px clears it with margin to spare and needs no further breakpoint above. */}
        <nav className="hidden min-[900px]:flex flex-1 items-center gap-6">
          {HEADER_NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[12.5px] text-muted no-underline transition-colors duration-[120ms] ease-out hover:text-strong hover:no-underline"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 ml-auto min-[900px]:ml-0">
          <span className="sl-num hidden min-[900px]:inline text-12 text-faint">
            {SITE_VERSION}
          </span>
          {/* 400px: below it wordmark + one gap + GitHub + its gap + the CTA overflows the
              320px floor; GitHub is the one link that can go, and returns at 400px with slack
              to spare (task-13 arithmetic pass). */}
          <a
            href={GITHUB_URL}
            className="hidden min-[400px]:inline-flex items-center gap-2 h-8 px-3 border border-border rounded-control text-body text-[12.5px] no-underline"
            target="_blank"
            rel="noreferrer"
          >
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
