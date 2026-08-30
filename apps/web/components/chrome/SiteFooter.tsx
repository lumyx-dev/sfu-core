import Link from 'next/link';
import { StatusDot } from '@sightline/ui';
import { FOOTER_COLUMNS } from '@/content/nav';
import s from './SiteFooter.module.css';

export function SiteFooter({ maxWidth = 1280 }: { maxWidth?: number }) {
  const maxWidthStyle = { maxWidth };
  return (
    <footer style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div
        className={`${s.grid} mx-auto px-5 pt-12 pb-8 md:px-6 lg:px-10`}
        style={maxWidthStyle}
      >
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2.5">
            <span aria-hidden className={s.brandMark} />
            <span className={s.brandName}>Sightline</span>
          </span>
          <p className={s.brandDesc}>
            Open-source WebRTC SFU with observability in the media path. Self-host it, or use Sightline Cloud.
          </p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title} className="flex flex-col gap-2.5">
            <span className="sl-label">{col.title}</span>
            {col.links.map((l) => (
              <Link key={l.label} href={l.href} className={s.link}>
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div
        className="mx-auto flex flex-wrap items-center gap-4 px-5 pb-8 md:px-6 lg:px-10"
        style={maxWidthStyle}
      >
        <span className={`sl-num ${s.meta}`}>MIT licensed · © 2026 Sightline</span>
        <span className="flex-1" />
        <span className={`sl-num ${s.meta}`}>All systems operational</span>
        <StatusDot status="live" size={7} />
      </div>
    </footer>
  );
}
