import Link from 'next/link';
import { StatusDot } from '@lumyx/ui';
import { FOOTER_COLUMNS } from '@/content/nav';

export function SiteFooter({ maxWidth = 1280 }: { maxWidth?: number }) {
  const maxWidthStyle = { maxWidth };
  return (
    <footer className="border-t border-border-subtle">
      <div
        className="grid grid-cols-1 gap-8 mx-auto px-5 pt-12 pb-8 md:px-6 lg:px-10 md:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]"
        style={maxWidthStyle}
      >
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2.5">
            <span aria-hidden className="block w-[18px] h-[18px] rounded-[6px] bg-accent flex-none" />
            <span className="text-13 font-semibold tracking-tight text-strong">Sightline</span>
          </span>
          <p className="text-12 leading-body text-muted max-w-[260px] [text-wrap:pretty]">
            Open-source WebRTC SFU with observability in the media path. Self-host it, or use Sightline Cloud.
          </p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title} className="flex flex-col gap-2.5">
            <span className="sl-label">{col.title}</span>
            {col.links.map((l) => (
              <Link key={l.label} href={l.href} className="text-[12.5px] text-muted no-underline">
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
        <span className="sl-num text-12 text-faint">MIT licensed · © 2026 Sightline</span>
        <span className="flex-1" />
        <span className="sl-num text-12 text-faint">All systems operational</span>
        <StatusDot status="live" size={7} />
      </div>
    </footer>
  );
}
