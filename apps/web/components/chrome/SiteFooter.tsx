import Link from 'next/link';
import { FOOTER_COLUMNS, SITE_VERSION } from '@/content/nav';
import { Wordmark } from './Wordmark';

export function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <span className="sl-label">{col.title}</span>
              {col.links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  style={{ fontSize: 12.5, color: 'var(--text-muted)', textDecoration: 'none' }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div
          className="mt-12 flex flex-wrap items-center justify-between gap-4 pt-6"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <Wordmark size={16} />
          <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {SITE_VERSION} · MIT
          </span>
        </div>
      </div>
    </footer>
  );
}
